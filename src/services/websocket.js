const logger = require('../logger');

class WebSocketService {
    constructor() {
        this.io = null;
        this.mqttClient = null;
        this.connectedClients = new Map(); // Przechowuje informacje o podłączonych klientach
    }

    // Integracja z istniejącym MQTT Socket Bridge
    initialize(io, mqttClient) {
        this.io = io;
        this.mqttClient = mqttClient;

        // Dodaj dodatkowe handlery do istniejącej instancji Socket.IO
        this.setupAdditionalHandlers();

        logger.info('WebSocket service integrated with MQTT Socket Bridge');
    }

    setupAdditionalHandlers() {
        if (!this.io) {
            logger.error('Socket.IO instance not available');
            return;
        }

        // Dodaj namespace dla ESP32 jeśli potrzebny
        const espNamespace = this.io.of('/esp');
        
        espNamespace.on('connection', (socket) => {
            logger.info(`ESP32 connected via Socket.IO: ${socket.id}`);
            this.connectedClients.set(socket.id, { type: 'esp', socket });

            socket.on('card_scanned', (data) => {
                this.handleCardScanned(data);
            });

            socket.on('status_update', (data) => {
                this.handleStatusUpdate(data);
            });

            socket.on('disconnect', () => {
                logger.info(`ESP32 disconnected: ${socket.id}`);
                this.connectedClients.delete(socket.id);
            });
        });

        // Dodaj dodatkowe eventy do głównego namespace
        this.io.on('connection', (socket) => {
            // Sprawdź czy to nie jest już obsługiwane przez mqttSocketBridge
            if (!this.connectedClients.has(socket.id)) {
                this.connectedClients.set(socket.id, { type: 'browser', socket });

                // Dodatkowe eventy dla przeglądarki
                socket.on('add_card', (data) => {
                    this.handleAddCardRequest(data, socket);
                });

                socket.on('get_status', () => {
                    socket.emit('status', this.getConnectionStatus());
                });

                socket.on('disconnect', () => {
                    this.connectedClients.delete(socket.id);
                });
            }
        });
    }

    handleMessage(data, clientType) {
        switch (data.action) {
            case 'add_card':
                this.handleAddCardRequest(data);
                break;
            case 'card_scanned':
                this.handleCardScanned(data);
                break;
            case 'ping':
                this.handlePing(clientType);
                break;
            default:
                logger.warn(`Unknown WebSocket action: ${data.action}`);
        }
    }

    handleAddCardRequest(data, socket = null) {
        // Integracja z istniejącym systemem MQTT
        if (this.mqttClient && data.deviceId) {
            logger.info(`Sending scan_card request to device: ${data.deviceId}`);
            
            const topic = `controller/${data.deviceId}/mode`;
            const message = JSON.stringify({ action: 'scan_new_card' });
            
            this.mqttClient.publish(topic, message, { qos: 1 }, (err) => {
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
            this.broadcastToBrowsers({ 
                action: 'error', 
                message: 'MQTT not available or deviceId missing' 
            });
        }
    }

    async handleCardScanned(data) {
        try {
            logger.info(`Card scanned with UID: ${data.uid}`);
            
            // TODO: Zapisz w bazie danych
            // const savedCard = await saveCard(data.uid);
            
            // Wyślij informację do wszystkich przeglądarek przez Socket.IO
            this.broadcastToBrowsers({ 
                action: 'card_added', 
                uid: data.uid,
                deviceId: data.deviceId,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error handling card scan:', error);
            this.broadcastToBrowsers({ 
                action: 'error', 
                message: 'Failed to process card scan' 
            });
        }
    }

    handleStatusUpdate(data) {
        logger.info('Device status update:', data);
        this.broadcastToBrowsers({
            action: 'device_status',
            ...data,
            timestamp: new Date().toISOString()
        });
    }

    handlePing(clientType, socket = null) {
        const pongMessage = { action: 'pong', timestamp: new Date().toISOString() };
        
        if (socket) {
            socket.emit('pong', pongMessage);
        } else {
            // Fallback - wyślij do wszystkich
            this.broadcastToBrowsers(pongMessage);
        }
    }

    broadcastToBrowsers(message) {
        if (!this.io) {
            logger.warn('Socket.IO not available for broadcasting');
            return;
        }

        // Wyślij do głównego namespace (przeglądarki)
        this.io.emit('broadcast', message);
        
        // Wyślij też do konkretnych eventów dla kompatybilności
        if (message.action) {
            this.io.emit(message.action, message);
        }
        
        logger.info('Message broadcasted to browsers via Socket.IO:', message);
    }

    sendToESP(message) {
        const espClients = Array.from(this.connectedClients.values())
            .filter(client => client.type === 'esp');

        if (espClients.length > 0) {
            espClients.forEach(client => {
                client.socket.emit('command', message);
            });
            logger.info('Message sent to ESP32 via Socket.IO:', message);
            return true;
        }

        // Fallback - użyj MQTT jeśli ESP nie połączony przez Socket.IO
        if (this.mqttClient && message.deviceId) {
            const topic = `controller/${message.deviceId}/command`;
            this.mqttClient.publish(topic, JSON.stringify(message), { qos: 1 });
            logger.info('Message sent to ESP32 via MQTT:', message);
            return true;
        }

        logger.warn('Cannot send message to ESP32 - not connected via Socket.IO or MQTT');
        return false;
    }

    getConnectionStatus() {
        const browserClients = Array.from(this.connectedClients.values())
            .filter(client => client.type === 'browser').length;
        
        const espClients = Array.from(this.connectedClients.values())
            .filter(client => client.type === 'esp').length;

        return {
            espConnected: espClients > 0,
            browserCount: browserClients,
            totalConnections: this.connectedClients.size,
            mqttConnected: this.mqttClient && this.mqttClient.connected
        };
    }

    // Metoda do użycia przez inne moduły - kompatybilność wsteczna
    triggerCardScan(deviceId = null) {
        if (deviceId) {
            return this.sendToESP({ action: 'scan_card', deviceId });
        }
        return this.sendToESP({ action: 'scan_card' });
    }

    // Metoda do powiadamiania o zmianach w systemie
    notifyCardAdded(cardData) {
        this.broadcastToBrowsers({
            action: 'card_added',
            ...cardData,
            timestamp: new Date().toISOString()
        });
    }

    // Nowa metoda dla integracji z MQTT Bridge
    notifyDeviceStatus(statusData) {
        this.broadcastToBrowsers({
            action: 'device_status',
            ...statusData,
            timestamp: new Date().toISOString()
        });
    }
}

// Eksport instancji singleton
const webSocketService = new WebSocketService();
module.exports = webSocketService;
