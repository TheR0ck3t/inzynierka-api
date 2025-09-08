const db = require('../modules/dbModules/db');
const logger = require('../logger');

const logAccess = async (req, res, next) => {
    const uid = req.params.uid;
    const reader = req.headers.reader;
    const status = req.accessStatus || 'PENDING';
    
    console.log(`logAccess middleware: UID=${uid}, Reader=${reader}, Status=${status}`);
    
    if (!uid) {
        logger.warn('No UID provided in request');
        return next();
    }
    
    try {
        // Użyj widoku employee_info aby pobrać wszystkie dane naraz
        const employeeInfo = await db.oneOrNone('SELECT * FROM employee_info WHERE tag_id = $1', [uid]);
        
        console.log(`Logging access for UID: ${uid}, Reader: ${reader}, Status: ${status}`);
        
        const result = await db.one(
            'INSERT INTO access_logs (tag_id, reader_id, action, status) VALUES ($1, $2, $3, $4) RETURNING access_id', 
            [uid, reader, 'access', status]
        );
        const accessId = result.access_id;
        
        // Przygotuj bogate dane do wysłania przez WebSocket
        const logData = {
            access_id: accessId,
            tag_id: uid,
            reader_id: reader,
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
        const { getNamespace } = require('../services/accessLogsWebSocket');
        const accessLogsNamespace = getNamespace();
        if (accessLogsNamespace) {
            accessLogsNamespace.emit('new-log', logData);
        }
        
    } catch (error) {
        logger.error(`Error logging access: ${error.message}`);
    }

    next();
};

module.exports = logAccess;
