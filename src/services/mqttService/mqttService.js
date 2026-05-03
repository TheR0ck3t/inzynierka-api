
const { setupMqttSocketBridge } = require('./mqttSocketBridge');
const mqtt = require('mqtt');
const db = require('../../modules/dbModules/db');
const logger = require('../../logger');

let mqttClient = null;
let io = null;
let isInitialized = false;

function initialize() {
    if (isInitialized) {
        logger.warn('MQTT Service already initialized');
        return { mqttClient };
    }
    try {   // Konfiguracja MQTT z obsługą zarówno URL, jak i oddzielnych parametrów
        const mqttConfig = {
            host: process.env.MQTT_BROKER_HOST || 'localhost', // adres brokera MQTT
            port: process.env.MQTT_BROKER_PORT || 1883, // port brokera MQTT
            username: process.env.MQTT_USERNAME, // nazwa użytkownika ACL
            password: process.env.MQTT_PASSWORD, // hasło użytkownika ACL
            clientId: `api_${Date.now()}`, // unikalny clientId dla API
            keepalive: 60,
            clean: true
        };
        const mqttUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
        // Wybierz konfigurację na podstawie dostępności zmiennych środowiskowych
        mqttClient = mqttConfig ? mqtt.connect(mqttConfig) : mqtt.connect(mqttUrl);
        isInitialized = true;
        logger.info(`MQTT Service initialized (broker: ${mqttUrl}, user: ${mqttConfig.username})`);
        return { mqttClient };
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
