const { Op, QueryTypes } = require('sequelize');
const { Comment } = require('../model/comment');
const { Driver } = require('../model/driver');
const { User } = require('../model/user');
const { Role } = require('../model/role');
const { ROLE } = require('../util/content')

const moment = require('moment');
const { sequelizeObj } = require('../sequelize/dbConf');
const { sequelizeDriverObj } = require('../sequelize/dbConf-driver');


module.exports.viewFeedbackHistory = async function (req, res) {
    let taskId = req.body.taskId
    let pageNum = Number(req.body.start);
    let pageLength = Number(req.body.length);

    let { count, rows } = await Comment.findAndCountAll({
        where: {
            taskId: {
                [Op.or]: [taskId, 'AT-' + taskId]
            },
        },
        order: [
            ['createdAt', 'desc']
        ],
        limit: pageLength,
        offset: pageNum
    })

    let result = []
    for (let row of rows) {
        let { question, starVal, options, createdBy, remark, driverId, createdAt, dataFrom } = row
        let name = ""
        if (dataFrom == 'TO') {
            name = await getDriverName(driverId)
        } else {
            name = await getUsername(createdBy)
        }
        result.push({
            question,
            starVal,
            options,
            name,
            remark,
            createdAt: moment(createdAt).format('DD/MM/YYYY HH:mm')
        })
    }
    return res.json({ data: result, recordsFiltered: count, recordsTotal: count })
}

const getDriverName = async function (driverId) {
    let name = ""
    let driverInfo = await Driver.findOne({
        attributes: ['name'],
        where: {
            driverId: driverId,
            driverFrom: 'transport'
        },
        order: [
            ['createdAt', 'desc']
        ]
    })
    if (driverInfo) {
        name = driverInfo.name
    }
    return name
}

const getUsername = async function (createdBy) {
    let name = ""
    let user = await User.findByPk(createdBy)
    if (user) {
        name = user.username
    }
    return name
}

const QueryMobiusSubUnits = async function () {
    let mobiusSubUnits = await sequelizeDriverObj.query(
        `SELECT
            id, subUnit AS name
        FROM unit
        WHERE subUnit IS NOT NULL;`,
        {
            type: QueryTypes.SELECT,
        }
    );
    return mobiusSubUnits
}

const getTSP = function (mobiusSubUnits, row) {
    if (row.tsp) {
        return row.tsp
    }

    let mvUnit = mobiusSubUnits.find(o => o.id == row.mobiusUnit)
    if (mvUnit) {
        return mvUnit.name
    }
    return ""
}

module.exports.initFeedbackTable = async function (req, res) {
    let userId = req.body.userId
    let user = await User.findByPk(userId)
    let role = await Role.findByPk(user.role)
    if (role.roleName != ROLE.RF) {
        return res.json({ data: [], recordsFiltered: 0, recordsTotal: 0 })
    }
    let { execution_date, unit, tripNo, vehicleType, category } = req.body
    let pageNum = Number(req.body.start);
    let pageLength = Number(req.body.length);
    let serviceTypeId = user.serviceTypeId || 0

    let mobiusSubUnits = await QueryMobiusSubUnits()

    let filter = ""
    let replacements = []
    if (execution_date) {
        filter += ` and b.executionDate = ?`
        replacements.push(execution_date)
    }
    if (unit) {
        filter += ` and r.groupId = ?`
        replacements.push(unit)
    }
    if (tripNo) {
        filter += ` and c.tripNo like ?`
        replacements.push(`${tripNo}%`)
    }
    if (vehicleType) {
        filter += ` and c.vehicleType = ?`
        replacements.push(vehicleType)
    }
    if (category) {
        filter += ` and st.category = ?`
        replacements.push(category)
    }

    let rows = await sequelizeObj.query(
        `select 
            a.taskId, a.createdAt, c.tripNo, b.externalJobId, b.startDate, sp.\`name\` as tsp, b.mobiusUnit, s.\`name\` as serviceMode, c.repeats, c.duration, c.vehicleType
        from (
            select 
                CASE 
                    WHEN taskId LIKE '%-%' THEN SUBSTRING_INDEX(taskId, '-', -1)
                    ELSE taskId
                END AS taskId,
                MAX(createdAt) as createdAt
            from \`comment\` GROUP BY taskId
        ) a 
        INNER JOIN job_task b on a.taskId = b.id
        LEFT JOIN job c on b.tripId = c.id
        LEFT JOIN service_mode s on c.serviceModeId = s.id
        LEFT JOIN service_type st on c.serviceTypeId = st.id
        LEFT JOIN service_provider sp on b.serviceProviderId = sp.id
        LEFT JOIN request r on b.requestId = r.id
        where c.serviceTypeId in (?) ${filter} ORDER BY a.createdAt desc limit ?,?`,
        {
            replacements: [serviceTypeId, ...replacements, pageNum, pageLength],
            type: QueryTypes.SELECT,
        }
    );

    for (let row of rows) {
        row.tsp = getTSP(mobiusSubUnits, row)
    }

    let countResult = await sequelizeObj.query(
        `select 
            count(a.taskId) as count
        from (
            select 
                CASE 
                    WHEN taskId LIKE '%-%' THEN SUBSTRING_INDEX(taskId, '-', -1)
                    ELSE taskId
                END AS taskId,
                MAX(createdAt) as createdAt
            from \`comment\` GROUP BY taskId
        ) a 
        INNER JOIN job_task b on a.taskId = b.id
        LEFT JOIN job c on b.tripId = c.id 
        LEFT JOIN service_type st on c.serviceTypeId = st.id
        LEFT JOIN request r on b.requestId = r.id
        where c.serviceTypeId in (?) ${filter}`,
        {
            replacements: [serviceTypeId, ...replacements],
            type: QueryTypes.SELECT,
        }
    );
    let count = countResult[0].count
    return res.json({ data: rows, recordsFiltered: count, recordsTotal: count })
}