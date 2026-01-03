const db = require('../../modules/dbModules/db');
const logger = require('../../logger');
const { type } = require('os');

const workTimeTracker = async (req, res, next) => {
    const uid = req.params.uid;
    const reader = req.headers.reader;
    logger.info(`workTimeTracker middleware: UID=${uid}, Reader=${reader}, IP: ${req.ip}`);

    if (!uid || !reader) {
        logger.warn(`Missing UID or reader in request from IP: ${req.ip}`);
        return next();
    }

    if (reader === 'mainEntrance' || reader === 'mainExit') {
        try {
            const employee = await db.oneOrNone('SELECT employee_id FROM tags WHERE tag_id = $1', [uid]);
            const employeeId = employee ? employee.employee_id : null;
            
            if (!employeeId) {
                logger.warn(`No employee found for tag: ${uid}, IP: ${req.ip}`);
                return next();
            }

            const activeSession = await db.oneOrNone('SELECT * FROM work_sessions WHERE employee_id = $1 AND shift_end IS NULL', [employeeId]);
            let statusChanged = false;

            if (reader === 'mainEntrance') {
                if (!activeSession) {
                    // Rozpocznij nową sesję tylko na wejściu
                    await db.none('INSERT INTO work_sessions (employee_id, shift_start) VALUES ($1, NOW())', [employeeId]);
                    logger.info(`Started new work session for UID: ${uid} at entrance, IP: ${req.ip}`);
                    statusChanged = true;
                } else {
                    logger.info(`Work session already active for UID: ${uid} - ignoring entrance scan, IP: ${req.ip}`);
                }
            } else if (reader === 'mainExit') {
                if (activeSession) {
                    // Zakończ sesję tylko na wyjściu i tylko jeśli istnieje
                    await db.none('UPDATE work_sessions SET shift_end = NOW() WHERE session_id = $1', [activeSession.session_id]);
                    logger.info(`Ended work session for UID: ${uid} at exit, IP: ${req.ip}`);
                    statusChanged = true;
                } else {
                    logger.info(`No active work session for UID: ${uid} - ignoring exit scan, IP: ${req.ip}`);
                }
            }

            // Emit WebSocket update jeśli status się zmienił
            if (statusChanged) {
                try {
                    const { emitStatusUpdate } = require('../../services/webSocketService/employeesStatusWebSocket');
                    emitStatusUpdate({
                        employee_id: employeeId,
                        action: reader === 'mainEntrance' ? 'started_work' : 'ended_work',
                        timestamp: new Date().toISOString()
                    });
                } catch (wsError) {
                    logger.error(`Error emitting WebSocket update: ${wsError.message}, IP: ${req.ip}`);
                }
            }

        } catch (error) {
            logger.error(`Error tracking work time for UID: ${uid}, Reader: ${reader}, IP: ${req.ip} - ${error.message}`);
        }
    }
    next();
};

module.exports = workTimeTracker;
