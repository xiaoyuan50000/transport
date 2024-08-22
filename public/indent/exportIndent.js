const ExportIndentDialog = function () {
    simplyForm(
        $("#exportIndentHtml").html(),
        function () {
            return InitDateSelector()
        },
        function () {
            let form = document.getElementById('export-form');
            form.classList.add('was-validated');
            checkExportFormInput(document.getElementById('export-startDate'))
            checkExportFormInput(document.getElementById('export-endDate'))
            if (form.checkValidity() === false) {
                return false
            } else {
                let startDate = parent.changeDateFormat($("#export-startDate").val())
                let endDate = parent.changeDateFormat($("#export-endDate").val())
                ConfirmExport(startDate, endDate)
            }
        })
}

const checkExportFormInput = function (input) {
    let value = input.value.trim();
    let errorFieldName = $(input).prev().html()
    let errorMsg = ""
    // input is fine -- reset the error message
    input.setCustomValidity('');
    // check empty
    errorMsg = value == "" ? errorFieldName + " is mandatory." : ""
    input.setCustomValidity(errorMsg);
    $(input).next().html(input.validationMessage)
}

const InitDateSelector = function () {
    layui.use(['laydate'], function () {
        let laydate = layui.laydate;
        laydate.render({
            elem: "#date-range",
            lang: 'en',
            type: 'date',
            trigger: 'click',
            // format: 'yyyy-MM-dd',
            format: 'dd/MM/yyyy',
            btns: ['clear', 'confirm'],
            range: ['#export-startDate', '#export-endDate']
        });
    });
}

const ConfirmExport = async function (startDate, endDate) {
    
    const filename = `Indent(${moment(startDate).format("YYYYMMDD")}-${moment(endDate).format("YYYYMMDD")}).xlsx`
    // axios({
    //     method: 'post',
    //     url: '/exportIndentToExcel',
    //     data: {
    //         startDate: startDate,
    //         endDate: endDate
    //     },
    //     responseType: 'arraybuffer',
    // }).then(res => {
    //     const blob = new Blob([res.data]);
    //     const url = URL.createObjectURL(blob);
    //     const link = document.createElement('a');
    //     link.href = url;
    //     link.download = filename;
    //     document.body.appendChild(link);
    //     link.click();
    //     document.body.removeChild(link);
    //     URL.revokeObjectURL(url);
    // }).catch((err) => {
    //     simplyAlert("Download failed.",'red')
    // })


    fetch('/exportIndentToExcel', {
        method: 'post',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            startDate: startDate,
            endDate: endDate
        }).toString(),
    })
        .then(response => {
            const stream = response.body;
            const reader = stream.getReader();
            let chunks = [];

            reader.read().then(function process(value) {
                if (value.done) {
                    executeDownloadTask(chunks, filename)
                    $("#export").html("Export Indent")
                    $("#export").attr("disabled", false)
                    document.getElementById('export').style.cssText = '';
                } else {
                    chunks.push(value.value);
                    reader.read().then(process);
                    $("#export").html(`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Downloading... `)
                    $("#export").attr("disabled", true)
                    $("#export").css("color", "white")
                }
            });
        })
        .catch((err) => {
            console.log(err);
            simplyAlert("Download failed.", 'red')
        })
}

const executeDownloadTask = function (chunks, filename) {
    const blob = new Blob(chunks, { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
}