const { setupMqttSocketBridge } = require('./mqqtSocketBridge');
const db = require('../modules/dbModules/db');
const logger = require('../logger');

class MqttService {
    constructor() {
        this.mqttClient = null;
        this.io = null;
        this.isInitialized = false;
    }

    initialize(server) {
        if (this.isInitialized) {
            logger.warn('MQTT Service already initialized');
            return { mqttClient: this.mqttClient, io: this.io };
        }

        try {
            const mqttUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
            
            const { mqttClient, io } = setupMqttSocketBridge({
                mqttUrl,
                server,
                db
            });

            this.mqttClient = mqttClient;
            this.io = io;
            this.isInitialized = true;

            logger.info(`MQTT Service initialized successfully  (broker: ${mqttUrl})`);

            return { mqttClient: this.mqttClient, io: this.io };
        } catch (error) {
            logger.error(`Failed to initialize MQTT Service: ${error.message}`);
            throw new Error(`MQTT Service initialization failed: ${error.message}`);
        }
    }

    getMqttClient() {
        if (!this.isInitialized) {
            throw new Error('MQTT Service not initialized. Call initialize() first.');
        }
        return this.mqttClient;
    }

    getSocketIO() {
        if (!this.isInitialized) {
            throw new Error('MQTT Service not initialized. Call initialize() first.');
        }
        return this.io;
    }

    isReady() {
        return this.isInitialized && this.mqttClient && this.io;
    }
}

// Singleton instance
const mqttService = new MqttService();

module.exports = mqttService;
