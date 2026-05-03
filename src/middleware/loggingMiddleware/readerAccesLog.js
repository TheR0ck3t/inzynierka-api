const db = require('../../modules/dbModules/db');
const logger = require('../../logger');

const logAccess = async (req, res, next) => {
    const uid = req.params.uid;
    const reader_name = req.headers.reader_name;
    const status = req.accessStatus || 'PENDING';
    
    if (!uid) {
        logger.warn('No UID provided in access log request');
        return next();
    }
    
    try {
        // Użyj widoku employee_info aby pobrać wszystkie dane naraz
        const employeeInfo = await db.oneOrNone('SELECT * FROM employee_info WHERE tag_id = $1', [uid]);
        // Znajdź reader w tabeli readers (używamy device_id lub reader_name)
        const readerData = await db.oneOrNone(
            'SELECT device_id FROM readers WHERE reader_name = $1', 
            [reader_name]
        );

        const device_id = readerData ? readerData.device_id : null;
        
        if (!device_id) {
            // Jeśli reader nie istnieje, użyj reader jako reader_id (backward compatibility)
            logger.warn(`Reader not found in database: ${reader_name}, using raw value`);
        }
        
        const result = await db.one(
            'INSERT INTO access_logs (tag_id, device_id, action, status) VALUES ($1, $2, $3, $4) RETURNING access_id', 
            [uid, device_id, 'access', status]
        );
        const accessId = result.access_id;
        
        // Przygotuj bogate dane do wysłania przez WebSocket
        const logData = {
            access_id: accessId,
            tag_id: uid,
            device_id: readerData?.device_id || device_id,
            reader_name: readerData?.reader_name || device_id,
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
        logger.info(`Access logged successfully: ${accessId}`);
    } catch (error) {
        logger.error(`Error logging access: ${error.message}`);
    }

    next();
};

module.exports = logAccess;
