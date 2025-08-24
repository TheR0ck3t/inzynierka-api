const logger = require('../logger');

function setupRfidControllerNamespace(io, connectedClients, handleCardScanned, handleStatusUpdate) {
    const rfidNamespace = io.of('/rfid');
    rfidNamespace.on('connection', (socket) => {
        logger.info(`Kontroler RFID connected via /rfid namespace: ${socket.id}`);
        connectedClients.set(socket.id, { type: 'esp', socket });
        socket.on('card_scanned', (data) => {
            handleCardScanned(data);
        });
        socket.on('status_update', (data) => {
            handleStatusUpdate(data);
        });
        socket.on('disconnect', () => {
            logger.info(`Kontroler RFID disconnected: ${socket.id}`);
            connectedClients.delete(socket.id);
        });
    });
}

function sendToESP(connectedClients, mqttClient, message) {
    const espClients = Array.from(connectedClients.values()).filter(client => client.type === 'esp');
    if (espClients.length > 0) {
        espClients.forEach(client => {
            client.socket.emit('command', message);
        });
        logger.info('Message sent to ESP32 via Socket.IO:', message);
        return true;
    }
    if (mqttClient && message.deviceId) {
        const topic = `controller/${message.deviceId}/command`;
        mqttClient.publish(topic, JSON.stringify(message), { qos: 1 });
        logger.info('Message sent to ESP32 via MQTT:', message);
        return true;
    }
    logger.warn('Cannot send message to ESP32 - not connected via Socket.IO or MQTT');
    return false;
}

function triggerCardScan(connectedClients, mqttClient, deviceId = null) {
    if (deviceId) {
        return sendToESP(connectedClients, mqttClient, { action: 'scan_card', deviceId });
    }
    return sendToESP(connectedClients, mqttClient, { action: 'scan_card' });
}

module.exports = {
    setupRfidControllerNamespace,
    sendToESP,
    triggerCardScan
};