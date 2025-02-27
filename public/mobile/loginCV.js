let currentSystemType = "CV";

function singpassLoginCallback(singpassResCode, nric) {
    console.log('singpassLoginCallback: singpassResCode=' + singpassResCode + ', nric=' + nric);
    let platName = navigator.userAgent;
    let isAndroid = platName.indexOf("Android") > -1 || platName.indexOf('Lindex') > -1;
    let regex = /\(i[^;]+;( U;)? CPU.+Mac OS X/
    let isIos = !!regex.exec(platName);

    if (singpassResCode == 0) {
        console.log('singpassLoginCallback: singpassResCode=' + singpassResCode + ', nric=' + nric);
        if (isAndroid) {
            window.android.logoutCallback();
        } else if (isIos) {
            window.webkit.messageHandlers.logoutCallback.postMessage('');
        }
        simplyAlert('Invalid system account, Nric: ' + (nric || 'null'), 'red');
    } else if (!nric) {
        if (isAndroid) {
            window.android.logoutCallback();
        } else if (isIos) {
            window.webkit.messageHandlers.logoutCallback.postMessage('');
        }
        simplyAlert("Singpass login fail, NIRC is null.", 'red');
    } else {
        console.log('singpassLoginCallback autoLogin: singpassResCode=' + singpassResCode + ', nric=' + nric);
        axios.post('./loginUseSingpass', {
            data: nric,
            mobileOS: getMobileOS()
        }).then(res => {
            if (res.data.code == 0) {
                simplyAlert(res.data.msg, 'red');
                return;
            }
            let data = res.data.data;
            console.log(JSON.stringify(res.data));
            // localStorage.setItem("user", JSON.stringify(data))
            localStorage.setItem("user", data)

            localStorage.setItem("loginPagePath", "mobileCV");
            top.location.href = "/mobileCV/"
        });
    }

};
