const logger = require('../logger');

let accessLogsNamespace = null;

function setupAccessLogsWebSocket(io) {
    console.log('Setting up accessLogsWebSocket...');
    accessLogsNamespace = io.of('/access-logs');
    accessLogsNamespace.on('connection', (socket) => {
        logger.info(`Client connected to /access-logs namespace: ${socket.id}`);
        socket.on('get_logs', (logData) => {
            console.log(`New access logs request received from ${socket.id}`);
            // logger.info(`Received get_logs request from ${socket.id}`);
            // Tutaj możesz dodać obsługę wysyłania historii logów, jeśli chcesz
        });
        socket.on('log-access', (logData) => {
            console.log(`New access log received from ${socket.id}:`, logData);
            // logger.info(`Received log-access event from ${socket.id}: ${JSON.stringify(logData)}`);
        });
        socket.on('disconnect', () => {
            logger.info(`Client disconnected from /access-logs namespace: ${socket.id}`);
        });
    });
}

function getNamespace() {
    return accessLogsNamespace;
}

module.exports = setupAccessLogsWebSocket;
module.exports.getNamespace = getNamespace;