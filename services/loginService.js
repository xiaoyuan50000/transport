const log4js = require('../log4js/log.js');
const log = log4js.logger('Login Service');
const utils = require('../util/utils');
const Response = require('../util/response.js');
const { JWTHeader } = require('../conf/jwt');
const moment = require('moment');

const { USER_STATUS, USER_ACTIVITY, LoginFrom, LoginType } = require('../util/content');
const { User } = require('../model/user');
const { Group } = require('../model/group');
const { Role } = require('../model/role');
const { LoginDetail } = require('../model/loginDetail.js');
const { UserManagementReport } = require('../model/userManagementReport');
const conf = require('../conf/conf.js');
const { sequelizeDriverObj } = require('../sequelize/dbConf-driver');
const { QueryTypes } = require('sequelize');


const cookieOptions = {
    httpOnly: true,
    secure: false,
    path: "/",
    sameSite: "Strict"
}

const ifPOCLoginSuccess = function (user) {
    return user != null && user.role != conf.poc_role_id
}

const checkLoginUser = async function (loginName, password) {
    let user = await User.findOne({ where: { loginName: loginName, password: password } });

    if (user != null) {
        let role = await Role.findByPk(user.role)
        if (!role) {
            return { user, loginError: "Login Failed. Invalid Role." }
        }
        if (role.roleName == "POC") {
            return { user, loginError: "Login Failed. POC user cannot login." }
        }
    } else {
        user = await User.findOne({ where: { loginName: loginName } });
        if (!user) {
            let { code, errorMsg } = await getUserExistByLoginName(loginName, null)
            if (code == 0) {
                return { user: null, loginError: errorMsg }
            }
        }
        if (!user) {
            return { user: null, loginError: "Login Failed. User does not exist." }
        }
    }
    return { user, loginError: "" }
}

const loginServer = async function (req, res) {
    let loginName = req.body.username;
    let password = req.body.password;
    let from = req.body.from;
    let mobileOS = req.body.mobileOS;
    try {

        let user = null;
        if (loginName) {
            let loginUser = await checkLoginUser(loginName, password)
            if (loginUser.loginError != "") {
                await CreateLoginDetail(loginName, password, loginUser.loginError, from, mobileOS)
                return Response.error(res, loginUser.loginError);
            }
            user = loginUser.user
        } else {
            user = await User.findOne({ where: { contactNumber: req.body.mobileNumber } });
            if (ifPOCLoginSuccess(user)) {
                const err = "Login Failed. Not POC User."
                await CreateLoginDetail(req.body.mobileNumber, password, err, from, mobileOS)
                return Response.error(res, err);
            }
        }

        if (user == null) {
            const err = "Login Failed. Login Name or Password is incorrect."
            await CreateLoginDetail(loginName, password, err, from, mobileOS)
            return Response.error(res, err);
        }

        let times = Number(user.times)
        let tryTimes = 2
        if (times > tryTimes) {
            const err = `Account [${loginName}] is locked, please contact administrator.`
            await CreateLoginDetail(loginName, password, err, from, mobileOS)
            return Response.error(res, err);
        }

        // valid password
        if (password.toLowerCase() != user.password.toLowerCase()) {
            await tryTimesExceeded(times, tryTimes, user)
            if (tryTimes - times == 0) {
                const err = `Login Failed. Account [${loginName}] is locked, please contact administrator.`
                await CreateLoginDetail(loginName, password, err, from, mobileOS)
                return Response.error(res, err);
            }
            const err = `Login Failed. Username or Password is incorrect. No. of tries left: ${tryTimes - times}`
            await CreateLoginDetail(loginName, password, err, from, mobileOS)
            return Response.error(res, err);
        }
        else if (user.ORDExpired) {
            const err = `Login Failed. Account [${loginName}] ORD Expired, please contact administrator.`
            await CreateLoginDetail(loginName, password, err, from, mobileOS)
            return Response.error(res, err);
        }
        // valid expried login
        else if (user.status == USER_STATUS.LockOut) {
            await lockOutUser(user)
            const err = `Account [${loginName}] is locked, please contact administrator.`
            await CreateLoginDetail(loginName, password, err, from, mobileOS)
            return Response.error(res, err);
        }
        else if (user.status == USER_STATUS.Deactivated) {
            await deactivatedUser(user)
            const err = `Account [${loginName}] is deactivated, please contact administrator.`
            await CreateLoginDetail(loginName, password, err, from, mobileOS)
            return Response.error(res, err);
        }

        let token = utils.generateTokenKey({ id: user.id, groupId: user.group, loginName: loginName, date: new Date() });
        let expireDate = moment(new Date()).add(JWTHeader.expire, "second")
        res.setHeader('Set-Cookie', `token=${token}; path=/; httpOnly; SameSite=Strict; expires=${expireDate}`)

        res.cookie("token", token, cookieOptions);

        let role = await Role.findByPk(user.role)
        user.roleName = getRoleName(role)
        let loginTime = new Date()
        await user.update({ times: 0, lastLoginTime: loginTime, token: token })
        await user.save()

        await updatePwdErrorTimes(user.id, 0, loginTime)
        let return_user = {
            roleName: user.roleName,
            username: user.username,
        }
        await CreateLoginDetail(loginName || req.body.mobileNumber, password, "Login Success.", from, mobileOS)
        return Response.success(res, utils.generateAESCode(JSON.stringify({ ...return_user, expire: expireDate, isFirstLogin: user.lastChangePasswordDate == null })));
        // return Response.success(res, { ...return_user, expire: expireDate, isFirstLogin: user.lastChangePasswordDate == null, token: token });
    } catch (ex) {
        log.error(ex)
        await CreateLoginDetail(loginName || req.body.mobileNumber, password, ex.toString(), from, mobileOS)
        return Response.error(res, "Login Failed.");
    }
};
module.exports.loginServer = loginServer;

const getRoleName = function (role) {
    return role != null ? role.roleName : ""
}

const tryTimesExceeded = async function (times, tryTimes, user) {
    if (times == tryTimes) {
        await user.update({ status: USER_STATUS.LockOut })
        await addUserManagementReport(user.id, "Account locked", USER_ACTIVITY.LockOut)
    } else {
        await user.update({ times: times + 1 })
        addUserManagementReport(user.id, times + 1, "Login Attempt Failed");
    }
    await updatePwdErrorTimes(user.id, times + 1)
}

const lockOutUser = async function (user) {
    if (user.getDataValue('status') == null) {
        await addUserManagementReport(user.id, "Last login date passed 90 days", USER_ACTIVITY.LockOut)
        await User.update({ status: USER_STATUS.LockOut }, { where: { id: user.id } })
    } else if (user.getDataValue('status') != USER_STATUS.LockOut) {
        await addUserManagementReport(user.id, "Account locked", USER_ACTIVITY.LockOut)
    }
}
module.exports.lockOutUser = lockOutUser

const deactivatedUser = async function (user) {
    if (user.getDataValue('status') == null) {
        await addUserManagementReport(user.id, "Last login date passed 180 days", USER_ACTIVITY.Deactivate)
        await User.update({ status: USER_STATUS.Deactivated }, { where: { id: user.id } })
    } else if (user.getDataValue('status') != USER_STATUS.Deactivated) {
        await addUserManagementReport(user.id, "Account deactivated", USER_ACTIVITY.Deactivate)
    }
}
module.exports.deactivatedUser = deactivatedUser

const getUserExistByLoginName = async function (loginName, fullname) {
    let filter = ""
    let replacements = [loginName]
    if (fullname) {
        filter += ` and fullName = ?`
        replacements.push(fullname)
    }
    let userBaseObj = await sequelizeDriverObj.query(
        `select id, cvApproveDate, cvApproveBy, cvRejectBy from user_base where cvRole is not null and loginName = ? ${filter} order by createdAt desc limit 1`,
        {
            replacements: replacements,
            type: QueryTypes.SELECT,
        }
    )
    if (userBaseObj.length == 0) {
        return { code: 0, errorMsg: `Login Failed. User does not exist.` }
    }
    let userBase = userBaseObj[0]
    if (userBase.cvRejectBy) {
        return { code: 0, errorMsg: `User Account creation was not successful.` }
    }
    if (!userBase.cvApproveBy && !userBase.cvApproveDate) {
        return { code: 0, errorMsg: `User Account pending approval.` }
    }
    return { code: 1, errorMsg: `` }
}
module.exports.getUserExistByLoginName = getUserExistByLoginName

const updatePwdErrorTimes = async function (userId, times, loginTime = null) {
    let mvUserId = await getMVUserId(userId)
    if (mvUserId == -1) {
        return
    }
    if (loginTime) {
        await sequelizeDriverObj.query(
            `update user set pwdErrorTimes = ?, lastLoginTime = ? where userId = ?`,
            {
                replacements: [times, loginTime, mvUserId],
                type: QueryTypes.UPDATE,
            }
        )
    } else {
        await sequelizeDriverObj.query(
            `update user set pwdErrorTimes = ? where userId = ?`,
            {
                replacements: [times, mvUserId],
                type: QueryTypes.UPDATE,
            }
        )
    }
}

const getMVUserId = async function (userId) {
    let userBase = await sequelizeDriverObj.query(
        `select mvUserId from user_base where cvUserId = ? limit 1`,
        {
            replacements: [userId],
            type: QueryTypes.SELECT,
        }
    )
    if (userBase && userBase[0] && userBase[0].mvUserId) {
        return userBase[0].mvUserId
    }
    return -1
}
module.exports.getMVUserId = getMVUserId

const addUserManagementReport = async function (userId, remark, action) {
    await UserManagementReport.create({
        userId: userId,
        remark: remark,
        operateDate: new Date(),
        activity: action,
        triggeredBy: "system"
    })
}
module.exports.addUserManagementReport = addUserManagementReport

const logoutServer = async function (req, res) {
    let userId = req.body.userId
    await sequelizeDriverObj.query(
        `update user set jwtToken = null where userId = (select mvUserId from user_base where cvUserId = ? limit 1)`,
        {
            replacements: [userId],
            type: QueryTypes.UPDATE,
        }
    )
    res.clearCookie('token');
    return Response.success(res, null);
}
module.exports.logoutServer = logoutServer;


module.exports.loginUseSingpass = async function (req, res) {
    let data = req.body.data
    let mobileOS = req.body.mobileOS
    let loginName = data.split('***')[0]
    let fullname = data.split('***')[1]
    let user = await User.findOne({ where: { loginName: loginName, username: fullname } });
    if (!user) {
        user = await User.findOne({ where: { loginName: loginName } });
        if (!user) {
            let { code, errorMsg } = await getUserExistByLoginName(loginName, fullname)
            if (code == 0) {
                await CreateSingpassLoginDetail(loginName, errorMsg, mobileOS)
                return Response.error(res, errorMsg);
            }
        }
        if (!user) {
            const err = "Login Failed. User does not exist."
            await CreateSingpassLoginDetail(loginName, err, mobileOS)
            return Response.error(res, err);
        }
    }
    let role = await Role.findByPk(user.role)
    if (!role) {
        const err = "Login Failed. Invalid Role."
        await CreateSingpassLoginDetail(loginName, err, mobileOS)
        return Response.error(res, err);
    }
    if (role.roleName == "POC") {
        const err = "Login Failed. POC user cannot login."
        await CreateSingpassLoginDetail(loginName, err, mobileOS)
        return Response.error(res, err);
    }

    if (user.status == USER_STATUS.LockOut) {
        await lockOutUser(user)
        const err = `Account [${loginName}] is locked, please contact administrator.`
        await CreateSingpassLoginDetail(loginName, err, mobileOS)
        return Response.error(res, err);
    } else if (user.status == USER_STATUS.Deactivated) {
        await deactivatedUser(user)
        const err = `Account [${loginName}] is deactivated, please contact administrator.`
        await CreateSingpassLoginDetail(loginName, err, mobileOS)
        return Response.error(res, err);
    }
    if (user.ORDExpired) {
        const err = `Login Failed. Account [${loginName}] ORD Expired, please contact administrator.`
        await CreateSingpassLoginDetail(loginName, err, mobileOS)
        return Response.error(res, err);
    }

    let token = utils.generateTokenKey({ id: user.id, groupId: user.group, loginName: loginName, date: new Date() });
    let expireDate = moment(new Date()).add(JWTHeader.expire, "second")
    res.setHeader('Set-Cookie', `token=${token}; path=/; httpOnly; SameSite=Strict; expires=${expireDate}`)

    res.cookie("token", token, cookieOptions);

    user.roleName = role != null ? role.roleName : ""
    // req.session.userId = user.id
    let loginTime = new Date();
    await user.update({ times: 0, lastLoginTime: loginTime, token: token })
    await user.save()

    await updatePwdErrorTimes(user.id, 0, loginTime)

    let return_user = {
        roleName: user.roleName,
        username: user.username,
    }
    await CreateSingpassLoginDetail(loginName, "Login Success.", mobileOS)
    return Response.success(res, utils.generateAESCode(JSON.stringify({ ...return_user, expire: expireDate, isFirstLogin: false })));
}

const LoginByMobiusServer = async function (req, res, next) {
    let params = req.query.token
    if (!params) {
        return next()
    }
    let loginInfo = utils.decodeAESCode(params)
    let { loginName, password } = JSON.parse(loginInfo)

    let user = await User.findOne({ where: { loginName: loginName, password: password } });
    if (!user) {
        const err = "Login Failed. User does not exist."
        await CreateSwitchLoginDetail(loginName, password, err)
        return res.render('login', { title: 'Login', error: err })
    }
    let role = await Role.findByPk(user.role)
    if (!role) {
        const err = "Login Failed. Invalid Role."
        await CreateSwitchLoginDetail(loginName, password, err)
        return res.render('login', { title: 'Login', error: err })
    }
    if (role.roleName == "POC") {
        const err = "Login Failed. POC user cannot login."
        await CreateSwitchLoginDetail(loginName, password, err)
        return res.render('login', { title: 'Login', error: err })
    }
    if (password.toLowerCase() != user.password.toLowerCase()) {
        const err = "Login Failed. Username or Password is incorrect."
        await CreateSwitchLoginDetail(loginName, password, err)
        return res.render('login', { title: 'Login', error: err })
    }

    let token = utils.generateTokenKey({ id: user.id, groupId: user.group, loginName: loginName, date: new Date() });
    let expireDate = moment(new Date()).add(JWTHeader.expire, "second")
    res.setHeader('Set-Cookie', `token=${token}; path=/; httpOnly; SameSite=Strict; expires=${expireDate}`)

    res.cookie("token", token, cookieOptions);

    user.roleName = role != null ? role.roleName : ""
    await user.update({ token: token })
    await user.save()

    let return_user = {
        roleName: user.roleName,
        username: user.username,
    }
    await CreateSwitchLoginDetail(loginName, password, "Login Success.")
    let userinfo = utils.generateAESCode(JSON.stringify({ ...return_user, expire: expireDate, isFirstLogin: user.lastChangePasswordDate == null }))
    return res.render('index', { title: 'Index', userinfo: userinfo });
}
module.exports.LoginByMobiusServer = LoginByMobiusServer

module.exports.reDirectToMobiusServer = async function (req, res) {
    let userId = req.body.userId
    let user = await User.findByPk(userId);
    let userinfo = JSON.stringify({ loginName: user.loginName, password: user.password })
    let str = utils.generateAESCode(userinfo)
    let url = `${conf.mobius_server_url}/?token=${str}`
    return Response.success(res, url)
}

module.exports.getDecodeAESCode = async function (req, res) {
    let { userId, data } = req.body
    if (data == 'undefined') {
        return Response.success(res, null)
    }
    let user = await User.findByPk(userId)
    if (!data) {
        await user.update({ token: null })
        await user.save()
        return Response.success(res, null)
    }
    let loginInfo = utils.decodeAESCode(data)
    let result = JSON.parse(loginInfo)
    if (userId) {
        let role = await Role.findByPk(user.role)
        let roleName = role.roleName
        result.roleName = roleName
    }
    return Response.success(res, result)
}

module.exports.reDirectToRegisterMV = async function (req, res) {
    let userId = req.body.userId
    let info = JSON.stringify({ dataFrom: 'system', userId: userId })
    let str = utils.generateAESCode(info)
    return Response.success(res, { mobius_server_url: conf.mobius_server_url, str: str })
}

const CreateLoginDetail = async function (loginName, password, description, from, mobileOS) {
    let record = {
        username: loginName,
        password: password,
        type: LoginType.Input,
        from: from,
        mobileOS: mobileOS,
        description: description
    }
    if (!from) {
        record.from = LoginFrom.CV
    }
    await LoginDetail.create(record)
}

const CreateSingpassLoginDetail = async function (loginName, description, mobileOS = null) {
    let record = {
        username: loginName,
        type: LoginType.Singpass,
        description: description,
    }
    if (mobileOS) {
        record.mobileOS = mobileOS
        record.from = LoginFrom.MobileCV
    } else {
        record.from = LoginFrom.CV
    }
    await LoginDetail.create(record)
}
module.exports.CreateSingpassLoginDetail = CreateSingpassLoginDetail

const CreateSwitchLoginDetail = async function (loginName, password, description) {
    await LoginDetail.create({
        username: loginName,
        password: password,
        type: LoginType.Switch,
        from: LoginFrom.MV,
        description: description
    })
}