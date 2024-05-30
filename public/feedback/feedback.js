let feedbackModal;
let feedbackHistoryTable;
let table;
let unitDatas;
$(function () {
    InitResource()
    InitExecutionDateSelector()
    initFeedbackHistoryListening()
    InitUnits().then(() => {
        InitUnitSearch()
        AddFilerListening()
        initFeedbackTable()
    })
})

const initFeedbackTable = function () {
    table = $('.feedback-table').DataTable({
        "ordering": false,
        "searching": false,
        "paging": true,
        "language": PageHelper.language(),
        "lengthMenu": PageHelper.lengthMenu(),
        "dom": PageHelper.dom(),
        "pageLength": PageHelper.pageLength(),
        "autoWidth": false,
        "processing": true,
        "serverSide": true,
        "destroy": true,
        "ajax": {
            url: "/initFeedbackTable",
            type: "POST",
            data: function (d) {
                let p = GetFilerParameters()
                p.start = d.start
                p.length = d.length
                return p
            },
        },
        "columns": [
            {
                "data": null, "title": "S/N",
                "render": function (data, type, full, meta) {
                    return meta.row + 1 + meta.settings._iDisplayStart
                }
            },
            {
                "data": "tripNo", "title": "Trip ID"
            },
            {
                "data": "externalJobId", "title": "Job ID"
            },
            {
                "data": "serviceMode", "title": "Service Mode"
            },
            {
                "data": "startDate", "title": "Execution Date",
                "render": function (data, type, full, meta) {
                    if (!full.repeats) {
                        return moment(data).format("DD/MM/YYYY HH:mm");
                    }

                    if (full.repeats == 'Period') {
                        return `<div>Period</div>
                                <div>${moment(full.startDate).format("DD/MM/YYYY HH:mm")}</div>`
                    } else if (full.duration) {
                        return `<div>Once(Duration ${full.duration}hr)</div>
                                    <div>${moment(full.startDate).format("DD/MM/YYYY HH:mm")}</div>`
                    } else {
                        return `<div>Once(no duration)</div>
                                    <div>${moment(full.startDate).format("DD/MM/YYYY HH:mm")}</div>`
                    }
                }
            },
            {
                "data": "vehicleType", "title": "Resources"
            },
            {
                "data": "tsp", "title": "TSP"
            },
            {
                "data": "createdAt", "title": "Date",
                "render": function (data, type, full, meta) {
                    return moment(data).format("DD/MM/YYYY HH:mm")
                }
            },
            {
                "data": "taskId", "title": "View Reviews",
                "render": function (data, type, full, meta) {
                    return `<button class="btn btn-sm me-1" title="Feedback" data-bs-toggle="modal" data-bs-target="#feedbackModal" data-bs-taskid="${data}" data-bs-tripno="${full.tripNo}">
                    <img src="../images/indent/action/view-workflow.svg"></button>`
                }
            },
        ]
    });
}

const initFeedbackHistoryListening = function () {
    feedbackModal = document.getElementById('feedbackModal')
    feedbackModal.addEventListener('hidden.bs.modal', function (event) {
        $("#feedbackModal").modal("dispose");
    })
    feedbackModal.addEventListener('show.bs.modal', function (event) {
        let button = event.relatedTarget
        let taskId = button.getAttribute('data-bs-taskid')
        let tripNo = button.getAttribute('data-bs-tripno')
        let modalTitle = feedbackModal.querySelector('.modal-title')
        modalTitle.textContent = `View Feedback ${tripNo}`
        feedbackHistoryTable = $('.table-feedback-detail').DataTable({
            "ordering": false,
            "searching": false,
            "paging": true,
            "language": PageHelper.language(),
            "lengthMenu": PageHelper.lengthMenu(),
            "dom": PageHelper.dom(),
            "pageLength": PageHelper.pageLength(),
            "autoWidth": false,
            "processing": true,
            "serverSide": true,
            "destroy": true,
            "ajax": {
                url: "/viewFeedbackHistory",
                type: "POST",
                data: function (d) {
                    d.taskId = taskId
                    return d
                },
            },
            "columns": [
                {
                    "data": null, "title": "S/N",
                    "render": function (data, type, full, meta) {
                        return meta.row + 1 + meta.settings._iDisplayStart
                    }
                },
                {
                    "data": "name", "title": "Name"
                },
                {
                    "data": null, "title": "Stars",
                    "render": function (data, type, full, meta) {
                        let startVal = full.starVal
                        let starColor = getRateColor(startVal)
                        let rateHtml = getRateHtml(startVal, starColor)
                        return rateHtml
                    }
                },
                {
                    "data": null, "title": "Feedbacks",
                    "render": function (data, type, full, meta) {
                        let remark = full.remark
                        let questionHtml = getQuestionHtml(remark, full.options)
                        return questionHtml
                    }
                },
                {
                    "data": "createdAt", "title": "Feedback Time",
                },
            ]
        });
    })
}

const getRateColor = function (startVal) {
    return startVal <= review.negativeStarVal ? review.starColor[1] : review.starColor[0]
}

const getRateHtml = function (startVal, starColor) {
    let maxStarVal = review.maxStarVal
    let liHtml = ""
    for (let i = 1; i <= maxStarVal; i++) {
        if (i <= startVal) {
            liHtml += `<li class="layui-inline"><i class="layui-icon layui-icon-rate-solid" style="color: ${starColor};"></i></li>`
        } else {
            liHtml += `<li class="layui-inline"><i class="layui-icon layui-icon-rate" style="color: ${starColor};"></i></li>`
        }
    }
    return `<div class="layui-inline">
                <ul class="layui-rate">
                ${liHtml}
                </ul>
            </div>`

}

const getQuestionHtml = function (question, options) {
    let optionsObj = JSON.parse(options)
    let list = optionsObj.filter(item => item.checked).map(item => {
        return item.option
    }).join(', ')
    let html = `
                    <div class="row m-0 p-0 mb-3">
                        <span class="review-question m-0 p-0"><span style="color: #000">${question}</span></span>
                    </div>
                    <div class="row m-0 p-0">
                        ${list}
                    </div>
                `
    return html
}

const InitResource = async function () {
    await axios.post("/getTypeOfVehicle", { serviceModeId: null }).then(res => {
        let vehicleTypeSelect = res.data.data
        $("#resource").empty();
        $("#resource").append(`<option value="">Resource: All</option>`)
        for (let item of vehicleTypeSelect) {
            $("#resource").append(`<option value="${item.typeOfVehicle}">${item.typeOfVehicle}</option>`)
        }
    })
}

const InitUnits = async function () {
    unitDatas = await axios.post("/findAllGroup").then(res => {
        return res.data.data
    })
}

const InitUnitSearch = function () {
    $("#indent-unit").on("click", function () {
        UnitOnFocus(this)
    })

    $("#unit1 .unit-search-select input").on("keyup", function () {
        let val = $(this).val()
        let filterUnits = unitDatas.filter(item => item.groupName.toLowerCase().indexOf(val.toLowerCase()) != -1)
        InsertFilterOption(this, filterUnits)
    })

    $("#unit1 .form-search-select").on("mousedown", "li", async function () {
        let val = $(this).html()
        let id = $(this).data("id")
        $(this).parent().parent().prev().val(val)
        $(this).parent().parent().prev().attr("data-id", id)
        $(this).parent().parent().css("display", "none")

        table.ajax.reload(null, true);
    })

    const UnitOnFocus = function (e) {
        $(e).next().css("display", "")
        $(e).next().find("input").val("");
        $(e).next().css("display", "block")
        // reset
        $(e).next().find(".form-search-select").empty()
        for (let item of unitDatas) {
            $(e).next().find(".form-search-select").append(`<li data-id="${item.id}">${item.groupName}</li>`)
        }
    }

    const InsertFilterOption = function (element, filterUnits) {
        $(element).next().empty()
        for (let item of filterUnits) {
            $(element).next().append(`<li data-id="${item.id}">${item.groupName}</li>`)
        }
    }

    $(document).on("click", function (e) {
        let target = e.target;
        if (target.id != "search-unit1" && target.id != "indent-unit") {
            $('.unit-search-select').css("display", "");
        }
    });
}

const FilterOnChange = function () {
    let len = $("#indent-filter input[name='trip-no']").val().length
    if (len > 0 && len < 8) {
        return
    }
    table.ajax.reload(null, true)
}

const InitExecutionDateSelector = function () {
    layui.use(['laydate'], function () {
        laydate = layui.laydate;
        let optStr = {
            elem: '#execution-date',
            lang: 'en',
            type: 'date',
            trigger: 'click',
            format: 'dd/MM/yyyy',
            btns: ['clear', 'confirm'],
            done: function () {
                FilterOnChange()
            }
        };
        laydate.render(optStr);
    });
}

const GetFilerParameters = function () {
    let tripNo = $("#indent-filter input[name='trip-no']").val()
    let vehicleType = $("#indent-filter select[name='resource']").val()
    let execution_date = $("#indent-filter input[name='execution-date']").val()
    execution_date = parent.changeFilterExecutionDateFmt(execution_date)
    let unit = $("#indent-filter input[name='indent-unit']").attr("data-id");
    let category = $("#indent-filter select[name='category']").val()
    return {
        "execution_date": execution_date,
        "unit": unit,
        "tripNo": tripNo,
        "vehicleType": vehicleType,
        "category": category,
    }
}

const AddFilerListening = function () {
    $("#indent-filter button[name='clean-all']").on('click', function () {
        $("#indent-filter input").val("")
        $("#indent-filter select").val("")
        $("#indent-filter input[name='indent-unit']").attr("data-id", '')
        table.ajax.reload(null, true)
    })
    $("#indent-filter input[name='trip-no']").on("keyup", FilterOnChange)
    $("#indent-filter select[name='resource']").on("change", FilterOnChange)
    $("#indent-filter select[name='category']").on("change", FilterOnChange)
    $("#indent-filter input[name='indent-unit']").on("keyup", FilterOnChange)
}