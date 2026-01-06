const db = require('../../modules/dbModules/db');
const logger = require('../../logger');
const { type } = require('os');

const workTimeTracker = async (req, res, next) => {
    const uid = req.params.uid;
    const reader = req.headers.reader;

    if (!uid || !reader) {
        logger.warn('Brakujący UID lub reader w workTimeTracker');
        return next();
    }

    if (reader === 'mainEntrance' || reader === 'mainExit') {
        try {
            const employee = await db.oneOrNone('SELECT employee_id FROM tags WHERE tag_id = $1', [uid]);
            const employeeId = employee ? employee.employee_id : null;
            
            if (!employeeId) {
                logger.warn(`Żaden pracownik nie posiada karty o tagu: ${uid}`);
                return next();
            }

            const activeSession = await db.oneOrNone('SELECT * FROM work_sessions WHERE employee_id = $1 AND shift_end IS NULL', [employeeId]);
            let statusChanged = false;

            if (reader === 'mainEntrance') {
                if (!activeSession) {
                    // Rozpocznij nową sesję tylko na wejściu
                    await db.none('INSERT INTO work_sessions (employee_id, shift_start) VALUES ($1, NOW())', [employeeId]);
                    logger.info(`Rozpoczęto nową sesję pracy dla UID: ${uid} przy wejściu`);
                    statusChanged = true;
                } else {
                    logger.info(`Sesja pracy już aktywna dla UID: ${uid} - pomijanie skanu wejścia`);
                }
            } else if (reader === 'mainExit') {
                if (activeSession) {
                    // Zakończ sesję tylko na wyjściu i tylko jeśli istnieje
                    await db.none('UPDATE work_sessions SET shift_end = NOW() WHERE session_id = $1', [activeSession.session_id]);
                    logger.info(`Zakończono sesję pracy dla UID: ${uid} przy wyjściu`);
                    statusChanged = true;
                } else {
                    logger.info(`Brak aktywnej sesji pracy dla UID: ${uid} - pomijanie skanu wyjścia`);
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
                    logger.error(`Błąd podczas wysyłania aktualizacji WebSocket: ${wsError.message}`);
                }
            }

        } catch (error) {
            logger.error(`Błąd śledzenia czasu pracy dla UID: ${uid}, Czytnik: ${reader}: ${error.message}`);
        }
    }
    next();
};

module.exports = workTimeTracker;
