const logger = require('../logger');
const { setupRfidControllerNamespace, sendToESP, triggerCardScan } = require('./rfidControllerWebsocket');

let io = null;
let mqttClient = null;
const connectedClients = new Map();

function initialize(socketIo, mqtt) {
    io = socketIo;
    mqttClient = mqtt;
    setupAdditionalHandlers();
    logger.info('WebSocket service integrated with MQTT Socket Bridge');
}

function setupAdditionalHandlers() {
    if (!io) {
        logger.error('Socket.IO instance not available');
        return;
    }
    // Obsługa browserów
    io.on('connection', (socket) => {
        if (!connectedClients.has(socket.id)) {
            connectedClients.set(socket.id, { type: 'browser', socket });
            socket.on('add_card', (data) => {
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