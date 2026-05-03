const logger = require('../../logger');
const { Server } = require('socket.io');
const { setupRfidControllerNamespace, sendToESP, triggerCardScan } = require('./rfidControllerWebsocket');
const accessLogsWebSocket = require('./accessLogsWebSocket');
const employeesStatusWebSocket = require('./employeesStatusWebSocket');
const readersListWebSocket = require('./readersListWebSocket');
const { namespaceJwtAuth } = require('./socketAuth');
const { setupMqttSocketBridge } = require('../mqttService/mqttSocketBridge');
const db = require('../../modules/dbModules/db');

let io = null;
let mqttClient = null;
const connectedClients = new Map();

function initialize(server, mqtt) {
    // Create Socket.IO server here (websocket foundations)
    const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
    io = new Server(server, {
        cors: {
            origin: allowedOrigin,
            methods: ['GET', 'POST']
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        upgradeTimeout: 30000,
        maxHttpBufferSize: 1e6,
        transports: ['websocket', 'polling'],
        allowUpgrades: true
    });

    mqttClient = mqtt;

    // Initialize bridge to attach MQTT handlers and subscriptions
    try {
        setupMqttSocketBridge({ mqttClient, io, db });
    } catch (err) {
        logger.error(`Failed to setup MQTT<->WebSocket bridge: ${err.message}`);
    }

    setupAdditionalHandlers();
    logger.info('WebSocket service initialized and integrated with MQTT Socket Bridge');
}

function setupAdditionalHandlers() {
    if (!io) {
        logger.error('Socket.IO instance not available');
        return;
    }
    io.use(namespaceJwtAuth({ namespaceName: '/' }));
    // Obsługa browserów
    io.on('connection', (socket) => {
        if (!connectedClients.has(socket.id)) {
            connectedClients.set(socket.id, { type: 'browser', socket });
            socket.on('add_card', (data) => {
                if (socket?.data?.user?.department_name !== 'IT') {
                    socket.emit('enrollError', { message: 'Insufficient permissions for enrollment' });
                    logger.warn(`WS enrollment denied for user ${socket?.data?.user?.email || 'unknown'} - department ${socket?.data?.user?.department_name || 'unknown'}`);
                    return;
                }

                const now = Date.now();
                const lastRequestAt = socket.data.lastAddCardAt || 0;
                if (now - lastRequestAt < 3000) {
                    socket.emit('enrollError', { message: 'Too many requests. Try again in a moment.' });
                    return;
                }
                socket.data.lastAddCardAt = now;

                if (!data || typeof data.deviceId !== 'string' || data.deviceId.trim().length === 0) {
                    socket.emit('enrollError', { message: 'Invalid deviceId' });
                    return;
                }
                handleAddCardRequest(data, socket);
            });
            socket.on('get_status', () => {
                socket.emit('status', getConnectionStatus());
            });
            socket.on('disconnect', () => {
                connectedClients.delete(socket.id);
            });
        }
    });
    // Obsługa ESP/kontrolera w osobnym namespace
    setupRfidControllerNamespace(io, connectedClients, handleCardScanned, handleStatusUpdate);
    // Obsługa logów dostępu w osobnym namespace
    accessLogsWebSocket(io);
    // Obsługa statusu pracowników w osobnym namespace
    employeesStatusWebSocket(io);
    // Obsługa listy czytników w osobnym namespace
    readersListWebSocket(io);
}

function handleMessage(data, clientType) {
    switch (data.action) {
        case 'add_card':
            handleAddCardRequest(data);
            break;
        case 'card_scanned':
            handleCardScanned(data);
            break;
        case 'ping':
            handlePing(clientType);
            break;
        default:
            logger.warn(`Unknown WebSocket action: ${data.action}`);
    }
}

function handleAddCardRequest(data, socket = null) {
    if (mqttClient && data.deviceId) {
        logger.info(`Sending scan_card request to device: ${data.deviceId}`);
        const topic = `controller/${data.deviceId}/mode`;
        const message = JSON.stringify({ action: 'scan_new_card' });
        mqttClient.publish(topic, message, { qos: 1 }, (err) => {
            if (err) {
                logger.error(`MQTT publish error: ${err.message}`);
                if (socket) {
                    socket.emit('enrollError', { message: 'MQTT publish failed' });
                }
            } else {
                if (socket) {
                    socket.emit('enrollStarted', { deviceId: data.deviceId });
                }
                logger.info(`Card enrollment started for device: ${data.deviceId}`);
            }
        });
    } else {
        logger.warn('Cannot send scan_card request - MQTT not available or deviceId missing');
        if (socket) {
            socket.emit('enrollError', { message: 'MQTT not available or deviceId missing' });
        }
        broadcastToBrowsers({ action: 'error', message: 'MQTT not available or deviceId missing' });
    }
}

async function handleCardScanned(data) {
    try {
        logger.info(`Card scanned with UID: ${data.uid}`);
        broadcastToBrowsers({ action: 'card_added', uid: data.uid, deviceId: data.deviceId, timestamp: new Date().toISOString() });
    } catch (error) {
        logger.error('Error handling card scan:', error);
        broadcastToBrowsers({ action: 'error', message: 'Failed to process card scan' });
    }
}

function handleStatusUpdate(data) {
    logger.info('Device status update:', data);
    broadcastToBrowsers({ action: 'device_status', ...data, timestamp: new Date().toISOString() });
}

function handlePing(clientType, socket = null) {
    const pongMessage = { action: 'pong', timestamp: new Date().toISOString() };
    if (socket) {
        socket.emit('pong', pongMessage);
    } else {
        broadcastToBrowsers(pongMessage);
    }
}

function broadcastToBrowsers(message) {
    if (!io) {
        logger.warn('Socket.IO not available for broadcasting');
        return;
    }
    io.emit('broadcast', message);
    if (message.action) {
        io.emit(message.action, message);
    }
    logger.info('Message broadcasted to browsers via Socket.IO:', message);
}

function getConnectionStatus() {
    const browserClients = Array.from(connectedClients.values()).filter(client => client.type === 'browser').length;
    const espClients = Array.from(connectedClients.values()).filter(client => client.type === 'esp').length;
    return {
        espConnected: espClients > 0,
        browserCount: browserClients,
        totalConnections: connectedClients.size,
        mqttConnected: mqttClient && mqttClient.connected
    };
}

function notifyCardAdded(cardData) {
    broadcastToBrowsers({ action: 'card_added', ...cardData, timestamp: new Date().toISOString() });
}

function notifyDeviceStatus(statusData) {
    broadcastToBrowsers({ action: 'device_status', ...statusData, timestamp: new Date().toISOString() });
}

module.exports = {
    initialize,
    handleMessage,
    handleAddCardRequest,
    handleCardScanned,
    handleStatusUpdate,
    handlePing,
    broadcastToBrowsers,
    getConnectionStatus,
    notifyCardAdded,
    notifyDeviceStatus,
    connectedClients,
    mqttClient,
    triggerCardScan: (deviceId) => triggerCardScan(connectedClients, mqttClient, deviceId),
    sendToESP: (message) => sendToESP(connectedClients, mqttClient, message)
};