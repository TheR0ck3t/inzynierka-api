const mqtt = require('mqtt');
const { Server } = require('socket.io');
const logger = require('../../logger');
const { getNamespace: getReadersListNamespace } = require('../webSocketService/readersListWebSocket');

function setupMqttSocketBridge({ mqttUrl, mqttConfig, server, db }) {
    // Use secure MQTT config if provided, otherwise fallback to URL
    const mqttClient = mqttConfig ? mqtt.connect(mqttConfig) : mqtt.connect(mqttUrl);
    
    const io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || '*',
            methods: ['GET', 'POST']
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        upgradeTimeout: 30000,
        maxHttpBufferSize: 1e8,
        transports: ['websocket', 'polling'],
        allowUpgrades: true
    });

    mqttClient.on('connect', () => {
        if (mqttConfig) {
            logger.info(`Connected to MQTT broker with security: ${mqttConfig.host}:${mqttConfig.port} (user: ${mqttConfig.username})`);
        } else {
            logger.info(`Connected to MQTT broker: ${mqttUrl}`);
        }
        
        mqttClient.subscribe('controller/keyCard/add', (err) => {
            if (err) {
                logger.error(`Failed to subscribe to topic: controller/keyCard/add - ${err.message}`);
            } else {
                logger.info('Successfully subscribed to topic: controller/keyCard/add');
            }
        });
        
        mqttClient.subscribe('controller/status', (err) => {
            if (err) {
                logger.error(`Failed to subscribe to topic: controller/status - ${err.message}`);
            } else {
                logger.info('Successfully subscribed to topic: controller/status');
            }
        });

        
        // Subskrybuj też rfid topics z kontrolera
        mqttClient.subscribe('rfid/scan', (err) => {
            if (err) {
                logger.error(`Failed to subscribe to topic: rfid/scan - ${err.message}`);
            } else {
                logger.info('Successfully subscribed to topic: rfid/scan');
            }
        });

        // Subskrybuj wiadomości o nowych kartach z enrollment
        mqttClient.subscribe('rfid/enrolled', (err) => {
            if (err) {
                logger.error(`Failed to subscribe to topic: rfid/enrolled - ${err.message}`);
            } else {
                logger.info('Successfully subscribed to topic: rfid/enrolled');
            }
        });
        
        // Subskrybuj aktualizacje listy czytników
        mqttClient.subscribe('readers/list_update', (err) => {
            if (err) {
                logger.error(`Failed to subscribe to topic: readers/list_update - ${err.message}`);
            } else {
                logger.info('Successfully subscribed to topic: readers/list_update');
            }
        });
        
        // Subskrybuj zmiany statusu czytników
        mqttClient.subscribe('readers/status_changed', (err) => {
            if (err) {
                logger.error(`Failed to subscribe to topic: readers/status_changed - ${err.message}`);
            } else {
                logger.info('Successfully subscribed to topic: readers/status_changed');
            }
        });
    });
    mqttClient.on('message', async (topic, messageBuffer) => {
        const message = messageBuffer.toString();
        logger.info(`Received MQTT message on topic ${topic}: ${message.substring(0, 200)}...`);
        
        try {
            const parts = topic.split('/');
            let deviceId, uid;
            
            if (parts[0] === 'controller' && parts[1] === 'keyCard') {
                // Handle keyCard messages
                const payload = JSON.parse(message);
                
                deviceId = payload.deviceId;
                uid = payload.uid;
            }
            
            else if (parts[0] === 'controller' && parts[1] === 'status') {
                // Handle status messages
                const statusData = JSON.parse(message);
                
                deviceId = statusData.deviceId;
                // Status nie potrzebuje dalszej obsługi z cardScanned
                return;
            }
            else if (parts[0] === 'readers' && parts[1] === 'list_update') {
                // Handle reader registry updates from kontroler
                const readers_list = JSON.parse(message);
                
                logger.info(`Received readers update from kontroler: ${readers_list.readers.length} readers`);
                
                // Broadcast do namespace /readers-list
                const readersListNamespace = getReadersListNamespace();
                if (readersListNamespace) {
                    readersListNamespace.emit('readers_list', readers_list);
                    logger.info(`Emitted readers_list event to /readers-list namespace`);
                } else {
                    logger.warn('readers-list namespace not initialized yet');
                }
                return;
            }
            else if (parts[0] === 'readers' && parts[1] === 'status_changed') {
                // Handle reader status changes (online/offline)
                const statusData = JSON.parse(message);
                
                logger.info(`Received readers status change: ${statusData.changes.length} changes`);
                
                // Broadcast do namespace /readers-list
                const readersListNamespace = getReadersListNamespace();
                if (readersListNamespace) {
                    readersListNamespace.emit('readers_status_changed', statusData);
                    logger.info(`Emitted readers_status_changed event to /readers-list namespace`);
                } else {
                    logger.warn('readers-list namespace not initialized yet');
                }
                return;
            }
            else if (parts[0] === 'rfid' && parts[1] === 'enrolled') {
                // Handle new card enrolled from ESP32
                const enrollData = JSON.parse(message);
                const { reader, tagId, sessionId, newSecret, secretWritten } = enrollData;
                
                logger.info(`Received rfid/enrolled: reader=${reader}, tagId=${tagId}, sessionId=${sessionId}, hasSecret=${!!newSecret}, secretWritten=${!!secretWritten}`);
                
                // Wyślij zapytanie do API o zapisanie karty
                const axios = require('axios');
                const apiUrl = process.env.API_URL;
                
                logger.info(`Calling API: POST ${apiUrl}/tags/rfid/save`);
                
                try {
                    const response = await axios.post(`${apiUrl}/tags/rfid/save`, {
                        headers: {
                            'x-mqtt-api-key': process.env.MQTT_API_KEY
                        },
                        data: {
                            reader: reader,
                            tagId: tagId,
                            sessionId: sessionId,
                            tagSecret: newSecret, // Dodaj secret do żądania
                            secretWritten: secretWritten // Informacja czy secret został zapisany na karcie
                        }
                    });

                    logger.info(`API response success: ${JSON.stringify(response.data)}`);
                    
                    // Wyślij sukces do WebSocket
                    io.emit('cardEnrolled', {
                        success: true,
                        tagId: tagId,
                        reader: reader,
                        hasSecret: !!newSecret,
                        secretWritten: !!secretWritten,
                        message: 'Card enrolled successfully'
                    });
                    
                    logger.info(`Card enrolled successfully: ${tagId} for reader ${reader} with secret (written: ${!!secretWritten})`);
                } catch (error) {
                    logger.error(`API call failed: ${error.message}`);
                    logger.error(`API response: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
                    
                    io.emit('cardEnrolled', {
                        success: false,
                        tagId: tagId,
                        reader: reader,
                        error: error.response?.data?.message || 'Failed to save card'
                    });
                }
                return;
            }

            // Obsługa cardScanned - tylko dla keyCard messages
            if (deviceId && uid) {
                // Broadcast do wszystkich klientów WebSocket
                io.emit('cardScanned', { uid, deviceId });
            }
            
        } catch (error) {
            logger.error(`Error handling MQTT message on topic ${topic} - ${error.message}`);
        }
    });

    mqttClient.on('error', (err) => {
        logger.error(`MQTT error: ${err.message}`);
    });

    // socket.io events
    io.on('connection', (socket) => {
        logger.debug(`WebSocket client connected: ${socket.id}`);

        socket.on('disconnect', () => {
            logger.debug(`WebSocket client disconnected: ${socket.id}`);
        });
    });

  return { mqttClient, io };
}

module.exports = { setupMqttSocketBridge };