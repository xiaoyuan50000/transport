const log4js = require('../log4js/log.js');
const log = log4js.logger('Export Service');
const { QueryTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');
const Response = require('../util/response.js');
const moment = require('moment');
const { sequelizeObj } = require('../sequelize/dbConf');
const xlsx = require('node-xlsx');
const { INDENT_STATUS } = require('../util/content')
const { User } = require('../model/user');
const utils = require('../util/utils');
const ExcelJS = require('exceljs');

let folder = './public/download/indent/'

// module.exports.ExportIndentToExcel = async function (req, res) {
//     let { startDate, endDate, userId } = req.body
//     let serviceTypeIds = await getServiceTypeByUserId(userId)

//     let datas = await GetIndentDataByDate(startDate, endDate, serviceTypeIds)
//     if (datas.length == 0) {
//         return Response.error(res, "No data found.")
//     }

//     if (!fs.existsSync(folder)) {
//         fs.mkdir(path.resolve(folder), { recursive: true }, (err) => {
//             if (err) {
//                 log.error(err)
//                 return Response.error(res, err.message);
//             }
//         });
//     }

//     let filename = `Indent(${moment(startDate).format("YYYYMMDD")}-${moment(endDate).format("YYYYMMDD")}).xlsx`
//     let filepath = folder + filename
//     console.time("write")
//     WriteDataIntoExcel(datas, filepath)
//     console.timeEnd("write")
//     return Response.success(res, filename)
// }

const getServiceTypeByUserId = async function (userId) {
    let user = await User.findByPk(userId)
    let serviceTypeIds = [0]
    if (user.serviceTypeId) {
        serviceTypeIds = user.serviceTypeId.split(',').map(o => parseInt(o, 10))
    }
    return serviceTypeIds
}

module.exports.ExportIndentToExcel = async function (req, res) {
    let { startDate, endDate, userId } = req.body
    let serviceTypeIds = await getServiceTypeByUserId(userId)

    let moreConfig = {
        page: 0,
        limit: 10000,
    };
    let tasks = await GetIndentCountDate(startDate, endDate, serviceTypeIds)
    let count = tasks.length
    
    let totalPage = Math.ceil(count / moreConfig.limit)

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter();
    const sheet = workbook.addWorksheet('sheet1');

    const title = ["Indent ID", "Task ID", "Job ID", "Tracking ID", "Unit", "Execution Date", "Pickup", "Dropoff", "Start Time", "End Date", "End Time", "Duration", "Seater", "TSP", "Service Mode", "Indent Status",
        "POC Name", "POC Contact", "Task Status", "Arrive Time", "Depart Time", "End Time", "Created Date", "Modified Date", "Funding", "Purpose", "Activity Name", "Trip Remarks", "RQ Justification", "Endorsement",
        "PO Number", "UCO Approval Date", "UCO Name", "UCO Contact", "RF Approval Date"]
    sheet.addRow(title).commit();

    const write = async (datas) => {

        for (let data of datas) {
            sheet.addRow(data).commit();
        }
        if (moreConfig.page >= totalPage) {
            await workbook.commit();
            return;
        }

        new Promise((resolve) => {
            let startIndex = moreConfig.page * moreConfig.limit
            let endIndex = startIndex + moreConfig.limit - 1
            if (endIndex > count - 1) {
                endIndex = count - 1
            }

            let startId = tasks[startIndex].id
            let endId = tasks[endIndex].id
            GetIndentDataByDate(startDate, endDate, serviceTypeIds, startId, endId).then(result => {
                moreConfig.page += 1;
                resolve(write(result));
            })
        });
    };

    let filename = `Indent(${moment(startDate).format("YYYYMMDD")}-${moment(endDate).format("YYYYMMDD")}).xlsx`

    res.setHeader(
        'Content-Type',
        // 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        'application/octet-stream'
    );
    res.setHeader(
        'Content-Disposition',
        `attachment; filename=${encodeURIComponent(filename)}`
    );
    workbook.stream.pipe(res);
    Promise.resolve().then(write([]));
}

// module.exports.ExportIndentToExcel = async function (req, res) {
//     let { startDate, endDate, userId } = req.body
//     let serviceTypeIds = await getServiceTypeByUserId(userId)

//     let moreConfig = {
//         page: 0,
//         limit: 10000,
//     };
//     let rows = await GetIndentDataByDate1(startDate, endDate, serviceTypeIds)
//     let indentCount = rows.length
//     if (indentCount == 0) {
//         return
//     }

//     let totalPage = Math.ceil(indentCount / moreConfig.limit)

//     const workbook = new ExcelJS.stream.xlsx.WorkbookWriter();
//     const sheet = workbook.addWorksheet('sheet1');

//     const title = ["Indent ID", "Task ID", "Job ID", "Tracking ID", "Unit", "Execution Date", "Pickup", "Dropoff", "Start Time", "End Date", "End Time", "Duration", "Seater", "TSP", "Service Mode", "Indent Status",
//         "POC Name", "POC Contact", "Task Status", "Arrive Time", "Depart Time", "End Time", "Created Date", "Modified Date", "Funding", "Purpose", "Activity Name", "Trip Remarks", "RQ Justification", "Endorsement",
//         "PO Number", "UCO Approval Date", "UCO Name", "UCO Contact", "RF Approval Date"]
//     sheet.addRow(title).commit();

//     const write = async (datas) => {
//         if (moreConfig.page >= totalPage) {
//             await workbook.commit();
//             return;
//         }

//         for (let data of datas) {
//             sheet.addRow(data).commit();
//         }

//         if (datas.length) {
//             moreConfig.page += 1;
//         }

//         new Promise((resolve) => {
//             let newRows = rows.slice(moreConfig.page * moreConfig.limit, moreConfig.limit + 1)
//             let result = handleRowData(newRows)
//             resolve(write(result));
//         });
//     };

//     let filename = `Indent(${moment(startDate).format("YYYYMMDD")}-${moment(endDate).format("YYYYMMDD")}).xlsx`

//     res.setHeader(
//         'Content-Type',
//         'application/octet-stream'
//     );
//     res.setHeader(
//         'Content-Disposition',
//         `attachment; filename=${encodeURIComponent(filename)}.xlsx`
//     );
//     workbook.stream.pipe(res);
//     Promise.resolve().then(write([]));
// }

module.exports.DownloadIndent = async function (req, res) {
    let { filename } = req.query

    let filepath = utils.getSafeFileName(folder + filename);

    let rs = fs.createReadStream(filepath);
    res.writeHead(200, {
        'Content-Type': 'application/force-download',
        'Content-Disposition': 'attachment; filename=' + filename
    });
    rs.pipe(res);
}

const GetIndentCountDate = async function (startDate, endDate, serviceTypeIds) {
    let rows = await sequelizeObj.query(
        `
        SELECT
            c.id
        FROM
                job_task c
            LEFT JOIN job b ON c.tripId = b.id
				where c.executionDate >= ? and c.executionDate <= ? and b.serviceTypeId in (?) order by c.id
        `,
        {
            replacements: [startDate, endDate, serviceTypeIds],
            type: QueryTypes.SELECT,
        })
    return rows
}

const GetIndentDataByDate = async function (startDate, endDate, serviceTypeIds, startId, endId) {
    console.time("query")

    let rows = await sequelizeObj.query(
        `WITH 
        oh_temp_remark AS (
            SELECT 
                    tripId, MAX(id) AS MaxId
            FROM operation_history
                    WHERE \`status\` = 'Pending for approval(UCO)' AND action = 'Edit Trip'
                    GROUP BY tripId
        ), 
        oh_temp_max AS (
                select 
                    a.tripId, Max(a.createdAt) as ucoApprovalTime, b.username, b.contactNumber
                from operation_history a
                LEFT JOIN \`user\` b on a.operatorId = b.id
                    where a.\`status\` = 'Pending for approval(RF)' and (a.action = 'Edit Trip' or a.action = 'Approve')
                    GROUP BY a.tripId
        ),
        oh_temp_min AS (
                select 
                    tripId, MIN(createdAt) as rfApprovalTime 
                from operation_history 
                    where \`status\` = 'Approved' and (action = 'Edit Trip' or action = 'Approve')
                    GROUP BY tripId
        )
        SELECT
                a.id AS indentId,
                d.groupName AS unit,
                c.startDate,
                c.pickupDestination,
                c.dropoffDestination,
                c.duration,
                e.\`name\` AS tsp,
                j.\`name\` AS serviceMode,
                b.\`status\` AS indentStatus,
                c.poc,
                c.pocNumber,
                c.taskStatus,
                c.arrivalTime,
                c.departTime,
                c.endTime,
                b.vehicleType,
                c.externalJobId,
                c.id AS taskId,
                c.trackingId,
                c.createdAt,
                c.updatedAt,
                b.periodEndDate,
                c.funding,
                a.additionalRemarks,
                a.purposeType,
                b.tripRemarks,
                c.endorse,
                c.poNumber,
                o.remark,
                o1.ucoApprovalTime,
                o1.username,
                o1.contactNumber,
                o2.rfApprovalTime
        FROM
                job_task c
        LEFT JOIN request a on c.requestId = a.id
        LEFT JOIN job b ON c.tripId = b.id
        LEFT JOIN \`group\` d ON a.groupId = d.id
        LEFT JOIN service_provider e ON ifnull(c.serviceProviderId, b.serviceProviderId) = e.id
        LEFT JOIN service_mode j ON b.serviceModeId = j.id
        LEFT JOIN ( 
            SELECT o.tripId, o.remark FROM operation_history o INNER JOIN oh_temp_remark p ON o.id = p.MaxId
        ) o on b.id = o.tripId
        LEFT JOIN oh_temp_max o1 on b.id = o1.tripId
        LEFT JOIN oh_temp_min o2 on b.id = o2.tripId
        where c.executionDate >= ? and c.executionDate <= ? and b.serviceTypeId in (?) and c.id between ? and ?`,
        {
            replacements: [startDate, endDate, serviceTypeIds, startId, endId],
            type: QueryTypes.SELECT,
        }
    );
    console.timeEnd("query")
    console.time("foreach")

    let excelJson = handleRowData(rows)
    console.timeEnd("foreach")
    return excelJson
}


const GetIndentDataByDate1 = async function (startDate, endDate, serviceTypeIds) {
    console.time("query")

    let rows = await sequelizeObj.query(
        `WITH 
        oh_temp_remark AS (
            SELECT 
                    tripId, MAX(id) AS MaxId
            FROM operation_history
                    WHERE \`status\` = 'Pending for approval(UCO)' AND action = 'Edit Trip'
                    GROUP BY tripId
        ), 
        oh_temp_max AS (
                select 
                    a.tripId, Max(a.createdAt) as ucoApprovalTime, b.username, b.contactNumber
                from operation_history a
                LEFT JOIN \`user\` b on a.operatorId = b.id
                    where a.\`status\` = 'Pending for approval(RF)' and (a.action = 'Edit Trip' or a.action = 'Approve')
                    GROUP BY a.tripId
        ),
        oh_temp_min AS (
                select 
                    tripId, MIN(createdAt) as rfApprovalTime 
                from operation_history 
                    where \`status\` = 'Approved' and (action = 'Edit Trip' or action = 'Approve')
                    GROUP BY tripId
        )
        SELECT
                a.id AS indentId,
                d.groupName AS unit,
                c.startDate,
                c.pickupDestination,
                c.dropoffDestination,
                c.duration,
                e.\`name\` AS tsp,
                j.\`name\` AS serviceMode,
                b.\`status\` AS indentStatus,
                c.poc,
                c.pocNumber,
                c.taskStatus,
                c.arrivalTime,
                c.departTime,
                c.endTime,
                b.vehicleType,
                c.externalJobId,
                c.id AS taskId,
                c.trackingId,
                c.createdAt,
                c.updatedAt,
                b.periodEndDate,
                c.funding,
                a.additionalRemarks,
                a.purposeType,
                b.tripRemarks,
                c.endorse,
                c.poNumber,
                o.remark,
                o1.ucoApprovalTime,
                o1.username,
                o1.contactNumber,
                o2.rfApprovalTime
        FROM
                job_task c
        LEFT JOIN request a on c.requestId = a.id
        LEFT JOIN job b ON c.tripId = b.id
        LEFT JOIN \`group\` d ON a.groupId = d.id
        LEFT JOIN service_provider e ON ifnull(c.serviceProviderId, b.serviceProviderId) = e.id
        LEFT JOIN service_mode j ON b.serviceModeId = j.id
        LEFT JOIN ( 
            SELECT o.tripId, o.remark FROM operation_history o INNER JOIN oh_temp_remark p ON o.id = p.MaxId
        ) o on b.id = o.tripId
        LEFT JOIN oh_temp_max o1 on b.id = o1.tripId
        LEFT JOIN oh_temp_min o2 on b.id = o2.tripId
        where c.executionDate >= ? and c.executionDate <= ? and b.serviceTypeId in (?)`,
        {
            replacements: [startDate, endDate, serviceTypeIds],
            type: QueryTypes.SELECT,
        }
    );
    console.timeEnd("query")
    return rows
}

const handleRowData = function (rows) {
    let excelJson = []

    rows.forEach(r => {
        let indentStatus = r.indentStatus
        if (indentStatus == INDENT_STATUS.IMPORTED) {
            indentStatus = INDENT_STATUS.APPROVED
        }
        excelJson.push([
            r.indentId,
            r.taskId,
            r.externalJobId,
            r.trackingId,
            r.unit,
            moment(r.startDate).format("DD/MM/YYYY"),
            r.pickupDestination,
            r.dropoffDestination,
            moment(r.startDate).format("HH:mm"),
            r.periodEndDate ? moment(r.periodEndDate).format("DD/MM/YYYY") : "",
            r.periodEndDate ? moment(r.periodEndDate).format("HH:mm") : "",
            r.duration,
            r.vehicleType,
            r.tsp,
            r.serviceMode,
            indentStatus,
            r.poc,
            r.pocNumber,
            UpperFirstChar(r.taskStatus),
            r.arrivalTime ? moment(r.arrivalTime).format("DD/MM/YYYY HH:mm") : "",
            r.departTime ? moment(r.departTime).format("DD/MM/YYYY HH:mm") : "",
            r.endTime ? moment(r.endTime).format("DD/MM/YYYY HH:mm") : "",
            moment(r.createdAt).format("DD/MM/YYYY HH:mm"),
            moment(r.updatedAt).format("DD/MM/YYYY HH:mm"),
            r.funding,
            r.additionalRemarks,
            r.purposeType,
            r.tripRemarks,
            r.remark,
            r.endorse ? "Yes" : "No",
            r.poNumber,
            r.ucoApprovalTime ? moment(r.ucoApprovalTime).format("DD/MM/YYYY HH:mm") : "",
            r.username || "",
            r.contactNumber || "",
            r.rfApprovalTime ? moment(r.rfApprovalTime).format("DD/MM/YYYY HH:mm") : ""
        ])
    })
    return excelJson
}

const WriteDataIntoExcel = function (datas, path) {
    let buffer = xlsx.build([
        {
            name: 'sheet1',
            data: datas
        }
    ]);
    path = utils.getSafeFileName(path);
    fs.writeFileSync(path, buffer, { 'flag': 'w' });
}

const UpperFirstChar = function (str) {
    if (str) {
        return str.replace(/( |^)[a-z]/g, (L) => L.toUpperCase());
    }
    return str
}