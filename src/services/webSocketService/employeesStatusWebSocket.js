const logger = require('../../logger');
const { namespaceJwtAuth } = require('./socketAuth');

let employeesStatusNamespace = null;

function setupEmployeesStatusWebSocket(io) {
    logger.info('Setting up employeesStatusWebSocket...');
    employeesStatusNamespace = io.of('/employees-status');
    employeesStatusNamespace.use(namespaceJwtAuth({ namespaceName: '/employees-status', allowedDepartments: ['HR', 'IT'] }));
    
    employeesStatusNamespace.on('connection', (socket) => {
        logger.info(`Client connected to /employees-status namespace: ${socket.id}`);
        
        socket.on('get_status', () => {
            logger.debug(`Status request received from ${socket.id}`);
            // Client prosi o aktualizację - może być użyte do force refresh
        });
        
        socket.on('disconnect', () => {
            logger.info(`Client disconnected from /employees-status namespace: ${socket.id}`);
        });
    });
}

function getNamespace() {
    return employeesStatusNamespace;
}

function emitStatusUpdate(data) {
    if (employeesStatusNamespace) {
        employeesStatusNamespace.emit('status-update', data);
        logger.debug('Emitted status-update to all clients');
    }
}

module.exports = setupEmployeesStatusWebSocket;
module.exports.getNamespace = getNamespace;
module.exports.emitStatusUpdate = emitStatusUpdate;
