
const { setupMqttSocketBridge } = require('./mqttSocketBridge');
const db = require('../../modules/dbModules/db');
const logger = require('../../logger');

let mqttClient = null;
let io = null;
let isInitialized = false;

function initialize(server) {
    if (isInitialized) {
        logger.warn('MQTT Service already initialized');
        return { mqttClient, io };
    }
    try {
        const mqttConfig = {
            host: process.env.MQTT_BROKER_HOST || 'localhost',
            port: process.env.MQTT_BROKER_PORT || 1883,
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
            clientId: `api_${Date.now()}`,
            keepalive: 60,
            clean: true
        };
        const mqttUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
        const result = setupMqttSocketBridge({ mqttUrl, mqttConfig, server, db });
        mqttClient = result.mqttClient;
        io = result.io;
        isInitialized = true;
        logger.info(`MQTT Service initialized with security (broker: ${mqttUrl}, user: ${mqttConfig.username})`);
        return { mqttClient, io };
    } catch (error) {
        logger.error(`Failed to initialize MQTT Service: ${error.message}`);
        throw new Error(`MQTT Service initialization failed: ${error.message}`);
    }
}

function getMqttClient() {
    if (!isInitialized) {
        throw new Error('MQTT Service not initialized. Call initialize() first.');
    }
    return mqttClient;
}

function getSocketIO() {
    if (!isInitialized) {
        throw new Error('MQTT Service not initialized. Call initialize() first.');
    }
    return io;
}

function isReady() {
    return isInitialized && mqttClient && io;
}

module.exports = {
    initialize,
    getMqttClient,
    getSocketIO,
    isReady
};
