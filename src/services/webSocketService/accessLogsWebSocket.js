const logger = require('../../logger');

let accessLogsNamespace = null;

function setupAccessLogsWebSocket(io) {
    logger.info(`Ustawianie WebSocket dla /access-logs namespace`);
    accessLogsNamespace = io.of('/access-logs');
    accessLogsNamespace.on('connection', (socket) => {
        logger.info(`Klient połączony z namespace /access-logs: ${socket.id}`);
        socket.on('get_logs', (logData) => {
            logger.info(`Nowy access logs request otrzymany od ${socket.id}`);
            // logger.info(`Received get_logs request from ${socket.id}`);
            // Tutaj możesz dodać obsługę wysyłania historii logów, jeśli chcesz
        });
        socket.on('log-access', (logData) => {
            logger.info(`Nowy access log otrzymany od ${socket.id}: ${JSON.stringify(logData)}`);
            // logger.info(`Received log-access event from ${socket.id}: ${JSON.stringify(logData)}`);
        });
        socket.on('disconnect', () => {
            logger.info(`Klient rozłączony z namespace /access-logs: ${socket.id}`);
        });
    });
}

function getNamespace() {
    return accessLogsNamespace;
}

module.exports = setupAccessLogsWebSocket;
module.exports.getNamespace = getNamespace;