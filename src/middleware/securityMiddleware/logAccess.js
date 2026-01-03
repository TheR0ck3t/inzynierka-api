const db = require('../../modules/dbModules/db');
const logger = require('../../logger');

const logAccess = async (req, res, next) => {
    const uid = req.params.uid;
    const reader = req.headers.reader;
    const status = req.accessStatus || 'PENDING';

    logger.info(`logAccess middleware: Logging access attempt for UID=${uid}, Reader=${reader}, Status=${status}, IP: ${req.ip}`);
    
    if (!uid) {
        logger.warn(`No UID provided in request from IP: ${req.ip}`);
        return next();
    }
    
    try {
        logger.info(`Logging access for UID: ${uid}, Reader:${reader}, Status:${status}, IP: ${req.ip}`);
        // Użyj widoku employee_info aby pobrać wszystkie dane naraz
        const employeeInfo = await db.oneOrNone('SELECT * FROM employee_info WHERE tag_id = $1', [uid]);

        // Znajdź reader w tabeli readers
        const readerData = await db.oneOrNone('SELECT * FROM readers WHERE name = $1', [reader]);
        
        if (!readerData) {
            // Jeśli reader nie istnieje, zwróć błąd
            logger.error(`Reader not found: ${reader}, IP: ${req.ip}`);
            throw new Error(`Reader '${reader}' not found in database`);
        }
        
        const result = await db.one(
            'INSERT INTO access_logs (tag_id, reader_id, action, status) VALUES ($1, $2, $3, $4) RETURNING access_id', 
            [uid, readerData.reader_id, 'access', status]
        );
        const accessId = result.access_id;
        
        // Przygotuj bogate dane do wysłania przez WebSocket
        const logData = {
            access_id: accessId,
            tag_id: uid,
            reader_id: readerData.reader_id,
            reader_name: readerData.name,
            reader_location: readerData.location,
            timestamp: new Date().toISOString(),
            action: 'access',
            status: status,
            employee_id: employeeInfo?.employee_id || null,
            employee_name: employeeInfo ? 
                `${employeeInfo.first_name} ${employeeInfo.last_name}` : 
                'Nieznany użytkownik',
            job_title: employeeInfo?.job_title || null,
            department_name: employeeInfo?.department_name || null
        };
        
        // Emituj event do wszystkich klientów po dodaniu loga
        const { getNamespace } = require('../../services/webSocketService/accessLogsWebSocket');
        const accessLogsNamespace = getNamespace();
        if (accessLogsNamespace) {
            accessLogsNamespace.emit('new-log', logData);
        }
        logger.info(`Access logged successfully: ${accessId}, IP: ${req.ip}`);
    } catch (error) {
        logger.error(`Error logging access: ${error.message}, IP: ${req.ip}`);
    }

    next();
};

module.exports = logAccess;
