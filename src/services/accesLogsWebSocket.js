const logger = require('../logger');
module.exports = function(io) {
    const accessLogsNamespace = io.of('/access-logs');
    accessLogsNamespace.on('connection', (socket) => {
        logger.info(`Client connected to /access-logs namespace: ${socket.id}`);
        socket.on('get_logs', (logData) => {
            console.log(`New access logs request received from ${socket.id}`);
            // logger.info(`Received get_logs request from ${socket.id}`);
            // Handle the request for access logs
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