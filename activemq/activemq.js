const log4js = require('../log4js/log.js');
const log = log4js.logger("MQInfo");
const systemSendTo3rdLog = log4js.logger("SystemSendTo3rdInfo");
const systemReceiveFrom3rdLog = log4js.logger("SystemReceiveFrom3rdInfo");
const conf = require('../conf/conf.js');

const Stomp = require('stomp-client');
const client = new Stomp(...conf.activeMQConf);
const activemqService = require('../services/activemqService')
const apiService = require('../services/apiService')
const { v4: uuidv4 } = require('uuid');
const randomStr = uuidv4().split('-').join('0')
const createJobTopic = '/topic/createJob/'+randomStr;
const cancelJobTopic = '/topic/cancelJob/'+randomStr;
const updateJobTopic = '/topic/updateJob/'+randomStr;
const transportAPITopic = '/topic/transportAPI/'+randomStr;

const bulkCreateJobTopic = '/topic/bulkCreateJob/'+randomStr;
const bulkCancelJobTopic = '/topic/bulkCancelJob/'+randomStr;

const taskAcceptTopic = '/topic/taskAcceptTopic/'+randomStr;



module.exports.initActiveMQ = function () {
    client.connect(function (sessionId) {
        log.info('Active MQ Server Connected!');
        log.info('SessionID: ', sessionId);
        client.subscribe(createJobTopic,  async function (body, headers) {
            systemSendTo3rdLog.info('From Active MQ Server(topic):', createJobTopic);
            systemSendTo3rdLog.info('From Active MQ Server(body):', body);
            await activemqService.affectCreateJobHandler(body)
        });

        client.subscribe(cancelJobTopic, async function (body, headers) {
            systemSendTo3rdLog.info('From Active MQ Server(topic):', cancelJobTopic);
            systemSendTo3rdLog.info('From Active MQ Server(body):', body);
            await activemqService.affectCancelJobHandler(body)
        });

        client.subscribe(updateJobTopic, async function (body, headers) {
            systemSendTo3rdLog.info('From Active MQ Server(topic):', updateJobTopic);
            systemSendTo3rdLog.info('From Active MQ Server(body):', body);
            await activemqService.affectUpdateJobHandler(body)
        });

        client.subscribe(transportAPITopic, async function (body, headers) {
            systemReceiveFrom3rdLog.info('From Active MQ Server(topic):', transportAPITopic);
            systemReceiveFrom3rdLog.info('From Active MQ Server(body):', JSON.stringify(JSON.parse(body), null, 2));
            await apiService.AffectTransportJsonApi(body)
        });

        client.subscribe(bulkCreateJobTopic, async function (body, headers) {
            systemSendTo3rdLog.info('From Active MQ Server(topic):', bulkCreateJobTopic);
            systemSendTo3rdLog.info('From Active MQ Server(body):', body);
            await activemqService.affectBulkCreateJobHandler(body)
        });

        client.subscribe(bulkCancelJobTopic, async function (body, headers) {
            systemSendTo3rdLog.info('From Active MQ Server(topic):', bulkCancelJobTopic);
            systemSendTo3rdLog.info('From Active MQ Server(body):', body);
            await activemqService.affectBulkCancelJobHandler(body)
        });

        client.subscribe(taskAcceptTopic, async function (body, headers) {
            systemReceiveFrom3rdLog.info('From Active MQ Server(topic):', taskAcceptTopic);
            systemReceiveFrom3rdLog.info('From Active MQ Server(body):', body);
            await apiService.AffectTaskAccept(body)
        });
    });
}

module.exports.publicCreateJobMsg = function (body) {
    publicMQMsg(createJobTopic, body)
};

module.exports.publicCancelJobMsg = function (body) {
    publicMQMsg(cancelJobTopic, body)
};
module.exports.publicUpdateJobMsg = function (body) {
    publicMQMsg(updateJobTopic, body)
};

module.exports.publicTransportAPIMsg = function (body) {
    publicMQMsg(transportAPITopic, body)
};

module.exports.publicBulkCreateJobMsg = function (body) {
    publicMQMsg(bulkCreateJobTopic, body)
};

module.exports.publicBulkCancelJobMsg = function (body) {
    publicMQMsg(bulkCancelJobTopic, body)
};

module.exports.publicTaskAcceptMsg = function (body) {
    publicMQMsg(taskAcceptTopic, body)
};

const publicMQMsg = function (topic, body) {
    try {
        client.publish(topic, body);
        log.info("Active MQ Send Topic : ", topic);
        log.info("Active MQ Send Body : ", body);
    } catch (e) {
        log.error(e);
    }
};