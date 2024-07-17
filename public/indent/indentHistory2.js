const queryActionHistory = async function (params, callback) {
    await axios.post("/indent/viewActionHistory",
        {
            tripId: params.tripId,
            taskId: params.historyTaskId,
        }).then(res => {
            let data = res.data.data
            callback(data)
        })
}
let historyTaskId = ""

const getRemarks = function (row) {
    return row.remark ? `(${row.remark})` : ""
}

const getChangeHistoryHtml = function (jobHistoryId) {
    if (jobHistoryId) {
        return `onclick=showChange(${jobHistoryId}) role="button"`
    }
    return ""
}

const getRole = function (role) {
    return role ? "(" + role + ")" : ""
}
const getContactNumber = function (contactNumber) {
    return contactNumber ? "(" + contactNumber + ")" : ""
}
const getEmail = function (email) {
    return email || ""
}
$(function () {
    let indentHistoryModal = document.getElementById('indentHistoryModal')
    indentHistoryModal.addEventListener('hidden.bs.modal', function (event) {
        if (historyTaskId == "") {
            StartRefreshIndent()
        }
    })
    indentHistoryModal.addEventListener('show.bs.modal', async function (event) {
        let button = event.relatedTarget
        let tripId = button.getAttribute('data-bs-trip')
        let tripNo = button.getAttribute('data-bs-tripno')
        historyTaskId = button.getAttribute('data-bs-taskid')
        if (historyTaskId == "") {
            StopRefreshIndent()
        }
        let modalTitle = indentHistoryModal.querySelector('.modal-title')
        modalTitle.textContent = 'View Trip History ' + tripNo

        await queryActionHistory({ tripId, historyTaskId }, function (datas) {
            let modalIndentFlow = indentHistoryModal.querySelector('.modal-indent-flow')
            let modalDriverFlow = indentHistoryModal.querySelector('.modal-driver-flow')
            let content = ``
            for (let row of datas.indentFlow) {
                let action = row.action.toLowerCase()
                let tripClass = GetTripClass(action)
                let username = row.username
                let contactNumber = row.contactNumber
                let groupName = row.groupName
                let remark = getRemarks(row)
                let createdAt = moment(row.createdAt).format("DD/MM HH:mm:ss")
                let role = row.roleName
                let jobHistoryId = row.jobHistoryId
                let changeHistoryHtml = getChangeHistoryHtml(jobHistoryId)
                let status = ""
                if (action == 'change status') {
                    let statusArr = row.status.split(" - ")
                    let status1 = statusArr[0]
                    let status2 = statusArr[1]
                    let class1 = GetItemClass(status1.toLowerCase())
                    let class2 = GetItemClass(status2.toLowerCase())
                    status = `(<label class="color-${class1}">${status1}</label> - <label class="color-${class2}">${status2}</label>)`
                }
                content += `<li class="custom-timeline-item custom-timeline-item-${tripClass}">
                        <div class="custom-timeline-status custom-timeline-content-action text-capitalize" ${changeHistoryHtml}>${action}</div>
                        <div class="row custom-timeline-content mt-1">`
                if (row.action != 'System Cancel') {
                    content += `<div class="mb-2">
                                <label class="fw-bold">${username}${getRole(role)}</label>
                            </div>
                            <div class="mb-2">
                            <label class="fw-bold">${groupName}${getContactNumber(contactNumber)}</label>
                            </div>
                            <div class="mb-2">
                            <label class="fw-bold">${getEmail(row.email)}</label>
                            </div>`
                }
                content += `<div class="mb-2">
                                <label class="color-time">${createdAt}</label>
                            </div>
                            <div class="mb-2">
                                ${status}
                            </div>
                            <div class="mb-2">
                                ${remark}
                            </div>
                        </div>
                    </li>`
            }
            modalIndentFlow.innerHTML = `${content}`

            let driverContent = ``
            for (let row of datas.driverFlow) {
                let externalTaskId = row.externalTaskId
                let poc = row.poc
                let mobileNumber = row.pocNumber
                let name = row.name
                let contactNumber = row.contactNumber
                let vehicleNumber = row.vehicleNumber
                let driverStatus = row.driverStatus
                let statusFlow = getDriverStatusHtml(driverStatus)
                driverContent += `<tr>
                    <td>${externalTaskId || "-"}</td>
                    <td>${poc}</td>
                    <td>${mobileNumber}</td>
                    <td>${name || "-"}</td>
                    <td>${contactNumber || "-"}</td>
                    <td>${vehicleNumber || "-"}</td>
                    <td>
                        <ul class="custom-timeline">
                            ${statusFlow}
                        </ul>
                    </td>
                </tr>`
            }
            modalDriverFlow.innerHTML = `${driverContent}`
        })
    })
})

const getDriverStatusHtml = function (driverStatus) {
    let statusFlow = ""
    for (let row of driverStatus) {
        let username = row.username
        let role = row.roleName
        let groupName = row.groupName
        let contactNumber = row.contactNumber
        let action = row.status.toLowerCase().replaceAll("_", " ")
        let itemClass = GetItemClass(action)
        let remark = row.remark

        let createdAt = moment(row.createdAt).format("DD/MM HH:mm:ss")
        let details = ""
        if (row.action == "Change Status" || row.action == "Reset") {
            details = `<div class="mb-1">
                                <label class="fw-bold">${username}${getRole(role)}</label>
                            </div>
                            <div class="mb-1">
                            <label class="fw-bold">${groupName}${getContactNumber(contactNumber)}</label>
                            </div>`
        } else if (row.action == "assigned" && row.operatorId == null) {
            let mvUserInfo = JSON.parse(row.remark)
            details = `<div class="mb-1">
                        <label class="fw-bold">${mvUserInfo.fullName}(${mvUserInfo.userType})</label>
                    </div>
                    <div class="mb-1">
                    <label class="fw-bold">${mvUserInfo.hub}(${mvUserInfo.contactNumber})</label>
                    </div>
                    <div class="mb-1">
                <label class="fw-bold">${mvUserInfo.email}</label>
                </div>`
            remark = ""
        } else if (row.operatorId == -1) {
            details = `<div class="mb-1">
                    <label class="fw-bold">Third party</label>
                </div>`
        } else if (row.operatorId != null && row.operatorId != 0) {
            details = `<div class="mb-1">
                                <label class="fw-bold">${username}${getRole(role)}</label>
                            </div>
                            <div class="mb-1">
                            <label class="fw-bold">${groupName}${getContactNumber(contactNumber)}</label>
                            </div>
                            <div class="mb-1">
                        <label class="fw-bold">${getEmail(row.email)}</label>
                        </div>`
        } else {
            details = `<div class="mb-1">
                            <label class="fw-bold">${remark}</label>
                        </div>`
            remark = ""
        }
        if (row.action == "System Cancel") {
            action = row.action
        }
        statusFlow += `<li class="mt-2 custom-timeline-item custom-timeline-item-${itemClass}">
                        <i class="custom-timeline-axis"></i>
                        <div class="row custom-timeline-content">
                            <div class="mb-1">
                                <label class="fw-bold text-capitalize driver-status">${action == "completed" ? "On-Time" : action}</label>
                                <label class="color-time ms-1">${createdAt}</label>
                            </div>
                            ${details}
                            <div class="mb-1">
                                ${remark}
                            </div>
                        </div>
                    </li>`
    }
    return statusFlow
}

const GetItemClass = function (action) {
    let itemClass = ""

    switch (action) {
        case 'assigned':
            itemClass = "assigned";
            break;
        case 'acknowledged':
            itemClass = "acknowledged";
            break;
        case 'started':
            itemClass = "started";
            break;
        case 'arrived':
            itemClass = "arrived";
            break;
        case 'completed':
            itemClass = "completed";
            break;
        case 'late trip':
            itemClass = "late";
            break;
        case 'no show':
            itemClass = "noshow";
            break;
        case 'declined':
            itemClass = "declined";
            break;
        case 'pending':
            itemClass = "pending";
            break;
        case 'collected':
            itemClass = "collected";
            break;
        case 'waiting for acknowledgement':
            itemClass = "waitingforack";
            break;
        case 'allocated':
            itemClass = "allocated";
            break;
        case 'endorse':
            itemClass = "endorsed";
            break;
        case 'unassigned':
            itemClass = "unassigned";
            break;
        case 'approved':
            itemClass = "approved";
            break;
        default:
            itemClass = "else";
            break;
    }
    return itemClass
}

const GetTripClass = function (action) {
    let itemClass = ""

    switch (action) {
        case 'new indent':
            itemClass = "create";
            break;
        case 'new trip':
            itemClass = "create";
            break;
        case 'edit trip':
            itemClass = "edit";
            break;
        case 'change status':
            itemClass = "change";
            break;
        default:
            itemClass = action;
            break;
    }
    return itemClass
}

const showChange = async function (jobHistoryId) {
    const GetLabelName = function (key) {
        let name = ""
        switch (key) {
            case 'category':
                name = "Category";
                break;
            case 'resourceType':
                name = "Resource Type";
                break;
            case 'serviceMode':
                name = "Service Mode";
                break;
            case 'resource':
                name = "Resource";
                break;
            case 'noOfResource':
                name = "No. Of Resource";
                break
            case 'driver':
                name = "Driver";
                break;
            case 'noOfDriver':
                name = "No. Of Driver";
                break;
            case 'reportingLocation':
                name = "Reporting Location";
                break;
            case 'destination':
                name = "Destination";
                break;
            case 'poc':
                name = "POC";
                break;
            case 'mobileNumber':
                name = "MObile Number";
                break;
            case 'recurring':
                name = "Recurring";
                break;
            case 'executionDate':
                name = "Execution Date";
                break;
            case 'duration':
                name = "Duration";
                break;
            case 'tripRemarks':
                name = "Trip Remarks";
                break;
            case 'periodStartDate':
                name = "Start Date";
                break;
            case 'periodEndDate':
                name = "End Date";
                break;
            case 'preParkDate':
                name = "Prepark Date";
                break;
            default:
                break;
        }
        return name
    }
    await axios.post("/showChangeOfIndent", { jobHistoryId }).then(res => {
        let data = res.data.data
        if (data.length == 0) {
            return
        }
        let content = data.map(ele => {
            return `<div class="mb-3">
                        <label class="fw-bold">${GetLabelName(ele.key)}</label> 
                        change from 
                        <label class="fw-bold color-pickup-destination">${ele.value[0]}</label>
                        to 
                        <label class="fw-bold color-dropoff-destination">${ele.value[1]}</label>
                    </div>`
        }).join("")
        $.alert({
            title: 'Edit Changes',
            content: content,
            boxWidth: '600px',
            useBootstrap: false,
        });
    })
}