const log4js = require('../log4js/log.js');
const log = log4js.logger('SystemCancelInfo');
const conf = require('../conf/conf')
const { QueryTypes } = require('sequelize');
const { sequelizeObj } = require('../sequelize/dbConf');
const requestService = require('../services/requestService2');

const schedule = require('node-schedule');
const text = 'System cancel'

// system cancel non-bus task
module.exports.scheduleStart = function () {
    schedule.scheduleJob(text, conf.system_cancel_schedule_cron, async () => {
        try {
            let datas = await sequelizeObj.query(
                `SELECT
                    b.id
                FROM
                    job a
                    LEFT JOIN job_task b ON a.id = b.tripId
                    LEFT JOIN service_type c on a.serviceTypeId = c.id 
                    WHERE 
                    c.\`name\` NOT LIKE 'Bus%' and c.category = 'CV' 
                    and b.taskStatus not in ('cancelled')
                    and TIME_TO_SEC(TIMEDIFF(CONCAT(b.executionDate,' ', b.executionTime), NOW())) <= 86400
                    and b.poNumber is null`,
                {
                    type: QueryTypes.SELECT
                }
            );
            log.info(`System cancel task id: ${datas.map(o => o.id)}`);

            for (let task of datas) {
                await requestService.SystemCancelTask(task.id)
            }

        } catch (ex) {
            log.error(ex)
        }
    })
}