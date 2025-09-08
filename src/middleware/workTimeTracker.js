const db = require('../modules/dbModules/db');
const logger = require('../logger');
const { type } = require('os');

const workTimeTracker = async (req, res, next) => {
    const uid = req.params.uid;
    const reader = req.headers.reader;
    logger.info(`workTimeTracker middleware: UID=${uid}, Reader=${reader}`);

    if (!uid || !reader) {
        logger.warn('Missing UID or reader in request');
        return next();
    }

    if (reader === 'mainEntrance' || reader === 'mainExit') {
        try {
            const employee = await db.oneOrNone('SELECT employee_id FROM tags WHERE tag_id = $1', [uid]);
            const employeeId = employee ? employee.employee_id : null;
            
            if (!employeeId) {
                logger.warn(`No employee found for tag: ${uid}`);
                return next();
            }

            const activeSession = await db.oneOrNone('SELECT * FROM work_sessions WHERE employee_id = $1 AND shift_end IS NULL', [employeeId]);

            if (reader === 'mainEntrance') {
                if (!activeSession) {
                    // Rozpocznij nową sesję tylko na wejściu
                    await db.none('INSERT INTO work_sessions (employee_id, shift_start) VALUES ($1, NOW())', [employeeId]);
                    logger.info(`Started new work session for UID: ${uid} at entrance`);
                } else {
                    logger.info(`Work session already active for UID: ${uid} - ignoring entrance scan`);
                }
            } else if (reader === 'mainExit') {
                if (activeSession) {
                    // Zakończ sesję tylko na wyjściu i tylko jeśli istnieje
                    await db.none('UPDATE work_sessions SET shift_end = NOW() WHERE session_id = $1', [activeSession.session_id]);
                    logger.info(`Ended work session for UID: ${uid} at exit`);
                } else {
                    logger.info(`No active work session for UID: ${uid} - ignoring exit scan`);
                }
            }

        } catch (error) {
            logger.error(`Error tracking work time for UID: ${uid}, Reader: ${reader} - ${error.message}`);
        }
    }
    next();
};

module.exports = workTimeTracker;
