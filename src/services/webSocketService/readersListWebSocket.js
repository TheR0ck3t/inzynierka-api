const logger = require('../../logger');

let readersListNamespace = null;

function setupReadersListWebSocket(io) {
    logger.info(`Ustawianie WebSocket dla /readers-list namespace`);
    readersListNamespace = io.of('/readers-list');
    readersListNamespace.on('connection', (socket) => {
        logger.info(`Klient połączony z namespace /readers-list: ${socket.id}`);
        
        // Wysyłaj ping co 20 sekund aby utrzymać połączenie
        const pingInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit('ping', { timestamp: Date.now() });
            }
        }, 20000);
        
        socket.on('pong', (data) => {
            logger.debug(`Received pong from ${socket.id}`);
        });
        
        socket.on('get_readers_list', (readersList) => {
            logger.info(`Nowy readers list request otrzymany od ${socket.id}`);
        });
        
        socket.on('readers_list', (readersList) => {
            logger.info(`Nowy readers list otrzymany od ${socket.id}: ${JSON.stringify(readersList)}`);
        });
        
        socket.on('disconnect', (reason) => {
            logger.info(`Klient rozłączony z namespace /readers-list: ${socket.id}, reason: ${reason}`);
            clearInterval(pingInterval);
        });
        
        socket.on('error', (error) => {
            logger.error(`Socket error for ${socket.id}:`, error);
        });
    });
}

function getNamespace() {
    return readersListNamespace;
}

module.exports = setupReadersListWebSocket;
module.exports.getNamespace = getNamespace;