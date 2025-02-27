$(function () {
    document.documentElement.style.userSelect='none';
    document.documentElement.style.webkitTouchCallout='none';

    let platName = navigator.userAgent;
    let isAndroid = platName.indexOf("Android")>-1 || platName.indexOf('Lindex')>-1;
    let regex = /\(i[^;]+;( U;)? CPU.+Mac OS X/
    let isIos = !!regex.exec(platName);
    
    autoLogin();

    $('.btn-login').on('click', function () {
        login();
    })
    
    $('.login-using-singpass').on('click', async function () {
        await axios.post('/mobileCV/mobileSingpass', {}).then(res => {
            if (res.data.code == 0) {
                simplyAlert(res.data.msg, 'red');
            } else if (isAndroid) {
                    window.android.singpassLogin(res.data.singpassUrl);
                } else if (isIos) {
                    window.webkit.messageHandlers.singpassLogin.postMessage(res.data.singpassUrl);
                } else {
                    //simplyAlert("Unsupport Operating System", 'red');
                    window.location.href = res.data.singpassUrl
                }
            
        });
    })

    $('.setting-div').on('click', function () {
        if (isAndroid) {
            window.android.settingIP();
        } else if (isIos) {
            window.webkit.messageHandlers.settingIP.postMessage({});
        } else {
            simplyAlert("Unsupport Operating System", 'red');
        }
    })
    $(".input-group").on('focusin', function(ele) {
        $(ele).removeClass('input-group-border');
    })
    $(".input-group").on('focusout', function(ele){
        $(ele).removeClass('input-group-border');
    });

    $(".regist-poc").on('click', function() {
        window.location.href="/mobilePOC/register-poc";
    });
    $(".change-pwd-poc").on('click', function() {
        window.location.href="/mobilePOC/changePocPwd";
    });
})

async function login() {
    let username = $('.username').val().trim().toUpperCase();
    let password = $('.password').val().trim();
    if (checkLogin(username, password)) {
        await loginRequest(username, CryptoJS.MD5(password).toString());
    }
}

function checkLogin(username, password) {
    if (username == "" || password == "") {
        simplyAlert("Username or password can not be empty.", 'red');
        return false;
    } else {
        return true;
    }
}

const loginRequest = async function (username, password, autoLogin = 0) {
    let params = {password: password, autoLogin: autoLogin, mobileOS: getMobileOS()};
    if (currentSystemType == 'CV') {
        params.username = username;
        params.from = "Mobile CV"
    } else {
        params.mobileNumber = username;
        params.from = "Mobile POC"
    }
    await axios.post('/loginServer', params).then(res => {
        if (res.data.code == 0) {
            simplyAlert(res.data.msg, 'red');
            return;
        }
        let data = res.data.data;
        // localStorage.setItem("user", JSON.stringify(data))
        localStorage.setItem("user", data)
        if (currentSystemType == 'CV') {
            localStorage.setItem("loginPagePath", "mobileCV");
            window.location.href = '/mobileCV/';
        }else {
            localStorage.setItem("loginPagePath", "mobilePOC");
            window.location.href = '/mobilePOC/';
        }
    });
};

async function autoLogin() {
    let user = localStorage.getItem("user")
    //current equipment has logined.
    if (user) {
        // user = JSON.parse(user)
        user = await getDecodeAESCode(user)
        if (moment(user.expireDate).diff(moment(new Date()), "s") < 0) {
            //is expired
            localStorage.clear();
        } else if (document.cookie.indexOf("token") == -1) {
            //no expired, but token is null, user is kick out by others.
            localStorage.clear();
            simplyAlert("You have logged in at another location. Your session has expired.", "red");
        } else if (currentSystemType == 'CV') {
                localStorage.setItem("loginPagePath", "mobileCV");
                window.location.href = '/mobileCV/';
            }else {
                localStorage.setItem("loginPagePath", "mobilePOC");
                window.location.href = '/mobilePOC/';
            }
        
    }
}

const getDecodeAESCode = async function (data) {
    return await axios.post('/getDecodeAESCode', {data: data}).then(res => {
        return res.data.data;
    });
}

const getMobileOS = function () {
    const agent = navigator.userAgent.toLowerCase();
    if (agent.indexOf("android") != -1) {
        return "Android"

    } else if (agent.indexOf("mac os") != -1) {
        return "IOS"

    } else if (agent.indexOf("windows") != -1) {
        return "Windows"
    }
    return "Unknow"
}