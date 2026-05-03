const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db'); // Import bazy danych
const mqttService = require('../../services/mqttService/mqttService'); // Import MQTT service
const logger = require('../../logger');
const crypto = require('crypto');
const authToken = require('../../middleware/authMiddleware/authToken'); // Import middleware auth
const mqttAuth = require('../../middleware/authMiddleware/mqttAuth'); // Import MQTT auth middleware
const readerAccesLog = require('../../middleware/loggingMiddleware/readerAccesLog'); // Import middleware readerAccesLog
const workTimeTracker = require('../../middleware/statsMiddleware/workTimeTracker'); // Import middleware workTimeTracker
const { addTagValidation, deleteTagValidation, enrollRfidValidation, updateSecretValidation, saveRfidValidation, checkAccessValidation } = require('../../validators/validators');
const validateRequest = require('../../middleware/validationMiddleware/validateRequest');
// Tymczasowe przechowywanie danych enrollment
let enrollmentSessions = new Map();
// Per-tag rotation locks to avoid concurrent rotations for same tag
const rotationLocks = new Map();

function acquireRotationLock(tagId) {
    if (rotationLocks.has(tagId)) return false;
    rotationLocks.set(tagId, true);
    return true;
}

function releaseRotationLock(tagId) {
    rotationLocks.delete(tagId);
}

router.get('/list', authToken('IT'), async (req, res) => {
    try {
        const data = await db.any('SELECT * FROM tags');
        res.json({
            status: 'success',
            message: 'Fetched all tags successfully',
            data: data
        });
    } catch (error) {
        logger.error(`Error fetching tags: ${error.message || error}`);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch tags',
            error: error.message || error
        });
    }
});

router.post('/add', authToken('IT'), addTagValidation, validateRequest, async (req, res) => {
    const tag = req.body.tag;
    const tagSecret = req.body.secret;

    if (!tag || !tagSecret) {
        return res.status(400).json({ message: 'Tag and secret are required' });
    }

    try {
        await db.transaction(async (t) => {
            const existingTag = await t.oneOrNone('SELECT * FROM tags WHERE "tag_id" = $1', [tag]);
            
            if (existingTag) {
                throw new Error('Tag already exists');
            }
            
            // Tag nie istnieje, wstaw go
            await t.none('INSERT INTO tags ("tag_id", "tag_secret") VALUES ($1, $2)', [tag, tagSecret]);
            logger.info(`Tag ${tag} został dodany`);
        });
        
        res.status(201).json({ message: 'Tag added successfully' });
    } catch (error) {
        logger.error(`Error adding tag: ${error.message || error}`);
        
        if (error.message === 'Tag already exists') {
            return res.status(400).json({ message: error.message });
        }
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to add tag.',
            error: error.message || error
        });
    }
});



// Endpoint POST /rfid/enroll - główny endpoint do rozpoczęcia enrollment
router.post('/rfid/enroll', authToken('IT'), enrollRfidValidation, validateRequest, async (req, res) => {
    const { reader = 'mainEntrance', employeeId } = req.body;

    if (!employeeId) {
        return res.status(400).json({
            error: 'Employee ID required',
            message: 'Employee ID is required for card enrollment'
        });
    }
    
    if (!mqttService.isReady()) {
        return res.status(503).json({ 
            error: 'MQTT Service not ready',
            message: 'Service is starting up, please try again later' 
        });
    }
    
    try {
        const mqttClient = mqttService.getMqttClient();
        
        // Zapisz sesję enrollment z employeeId
        const sessionId = `${reader}_${Date.now()}`;
        enrollmentSessions.set(reader, {
            employeeId: employeeId,
            sessionId: sessionId,
            timestamp: Date.now(),
            userId: req.user.user_id // Dodaj ID użytkownika który rozpoczął enrollment
        });
        
        // Ustaw timeout dla sesji (30 sekund)
        setTimeout(() => {
            if (enrollmentSessions.has(reader)) {
                logger.warn(`Enrollment session timeout for reader: ${reader}`);
                enrollmentSessions.delete(reader);
            }
        }, 30000);
        
        // Wyślij komendę do ESP32 przez MQTT: "start_enrollment"
        const topic = 'rfid/command';
        const command = JSON.stringify({
            action: 'start_enrollment',
            reader_name: reader,
            sessionId: sessionId
        });
    logger.info(`Publishing enrollment command to MQTT -> topic: ${topic}, payload: ${command}`);
        
        await new Promise((resolve, reject) => {
            mqttClient.publish(topic, command, { qos: 1 }, (err) => {
                if (err) {
                    logger.error(`MQTT publish error for enrollment: ${err.message}`);
                    // Usuń sesję jeśli publikacja się nie powiodła
                    enrollmentSessions.delete(reader);
                    reject(new Error('Failed to send enrollment command to reader'));
                } else {
                    resolve();
                }
            });
        });
        
        logger.info(`RFID enrollment started for reader: ${reader}`);
        res.json({ 
            success: true,
            message: `RFID enrollment started for reader ${reader}`,
            reader: reader,
            instructions: 'Please scan your card on the RFID reader. Listen for WebSocket events for real-time updates.'
        });
        
    } catch (error) {
        logger.error(`Error starting RFID enrollment: ${error.message}`);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message || 'Failed to start RFID enrollment process'
        });
    }
});

// Endpoint do zapisywania nowej karty z enrollment
router.post('/rfid/save', mqttAuth, saveRfidValidation, validateRequest, async (req, res) => {
    const { reader, tagId, sessionId, tagSecret } = req.body;
    
    logger.info(`Saving RFID card: reader=${reader}, tagId=${tagId}, sessionId=${sessionId}, hasSecret=${!!tagSecret}`);
    
    if (!reader || !tagId) {
        return res.status(400).json({
            error: 'Missing required fields',
            message: 'Reader and tagId are required'
        });
    }
    
    try {
        // Znajdź sesję enrollment
        const session = enrollmentSessions.get(reader);
        logger.info(`Enrollment session for ${reader}:`, session);
        
        if (!session) {
            logger.warn(`No enrollment session found for reader: ${reader}`);
            logger.warn(`Available sessions:`, Array.from(enrollmentSessions.keys()));
            return res.status(400).json({
                error: 'No enrollment session',
                message: 'No active enrollment session for this reader'
            });
        }
        
        const { employeeId } = session;
        logger.info(`Found employeeId: ${employeeId} for session`);
        
        // Sprawdź czy tag już istnieje
        const existingTag = await db.oneOrNone('SELECT * FROM tags WHERE tag_id = $1', [tagId]);
        
        if (existingTag) {
            // Jeśli tag już istnieje, sprawdź czy nie jest przypisany do innego pracownika
            const employeeWithTag = await db.oneOrNone('SELECT * FROM employees WHERE keycard_id = $1', [tagId]);
            
            if (employeeWithTag && employeeWithTag.employee_id !== parseInt(employeeId)) {
                throw new Error(`Card is already assigned to another employee`);
            }
            
            // Zaktualizuj secret jeśli podano
            if (tagSecret) {
                await db.query('UPDATE tags SET tag_secret = $1 WHERE tag_id = $2', [tagSecret, tagId]);
                logger.info(`Updated secret for existing tag: ${tagId}`);
            }
        } else {
            // Tag nie istnieje, dodaj go z employeeId i secret
            logger.info(`Inserting new tag with employeeId: ${employeeId} and secret`);
            const insertQuery = tagSecret 
                ? 'INSERT INTO tags (tag_id, employee_id, tag_secret) VALUES ($1, $2, $3)'
                : 'INSERT INTO tags (tag_id, employee_id) VALUES ($1, $2)';
            const insertParams = tagSecret 
                ? [tagId, employeeId, tagSecret]
                : [tagId, employeeId];
            
            await db.query(insertQuery, insertParams);
        }
        
        // Przypisz kartę do pracownika
        await db.query('UPDATE employees SET keycard_id = $1 WHERE employee_id = $2', [tagId, employeeId]);
        
        // Usuń sesję enrollment
        enrollmentSessions.delete(reader);
        
        logger.info(`Card ${tagId} assigned to employee ${employeeId} with secret support`);
        res.json({
            success: true,
            message: 'Card enrolled and assigned successfully',
            tagId: tagId,
            employeeId: employeeId,
            hasSecret: !!tagSecret
        });
        
    } catch (error) {
        logger.error(`Error saving enrolled card: ${error.message || error}`);
        res.status(500).json({
            error: 'Database error',
            message: error.message || 'Failed to save enrolled card'
        });
    }
});

router.delete('/delete/:tagId', authToken('IT'), deleteTagValidation, validateRequest, async (req, res) => {
    const { tagId } = req.params;

    if (!tagId) {
        return res.status(400).json({
            error: 'Missing required fields',
            message: 'tagId is required'
        });
    }

    try {
        // Usuń kartę RFID z bazy danych
        await db.none('DELETE FROM tags WHERE tag_id = $1', [tagId]);
        
        // Usuń przypisanie karty z pracownika
        await db.none('UPDATE employees SET keycard_id = NULL WHERE keycard_id = $1', [tagId]);
        
        logger.info(`Card ${tagId} deleted successfully`);
        res.json({
            success: true,
            message: 'Card deleted successfully',
            tagId: tagId
        });
        
    } catch (error) {
        logger.error(`Error deleting RFID card: ${error.message || error}`);
        res.status(500).json({
            error: 'Database error',
            message: error.message || 'Failed to delete RFID card'
        });
    }
});

router.get('/check-access/:uid', 
    mqttAuth, // middleware autentykujące kontroler IoT
    checkAccessValidation,  // walidacja danych wejściowych
    validateRequest, // middleware do obsługi wyników walidacji
    async (req, res) => { // główna logika endpointu
    const uid = req.params.uid;
    const current_secret = req.headers.current_secret // Secret może być w query lub header
    const new_secret = req.headers.new_secret;

    try {
        const tag = await db.oneOrNone('SELECT * FROM tags WHERE tag_id = $1', [uid]);
        
        if (!tag) {
            logger.warn(`No tag found for UID: ${uid}`);
            req.accessStatus = 'DENIED';
            readerAccesLog(req, res, () => {}); // Zaloguj próbę dostępu z nieznanym tagiem
            return res.json({
                error: 'Not found',
                response: 'DENIED',
                reason: 'Tag not registered'
            });
        }

        // Sprawdź secret jeśli tag ma przypisany secret
        if (tag.tag_secret) {
            if (!current_secret) {
                logger.warn(`Tag ${uid} requires secret but none provided`);
                req.accessStatus = 'DENIED';
                readerAccesLog(req, res, () => {}); // Zaloguj próbę dostępu bez secret
                return res.json({
                    response: 'DENIED',
                    reason: 'Secret required'
                });
            }
            
            if (tag.tag_secret !== current_secret) {
                logger.warn(`Invalid secret for tag ${uid}`);
                req.accessStatus = 'DENIED';
                readerAccesLog(req, res, () => {}); // Zaloguj próbę dostępu z nieprawidłowym secret
                return res.json({
                    response: 'DENIED',
                    reason: 'Invalid secret'
                });
            }
        }

        // Sprawdź czy tag jest przypisany do aktywnego pracownika
        if (tag.employee_id) {
            const employee = await db.oneOrNone('SELECT * FROM employees WHERE employee_id = $1', [tag.employee_id]);
            
            if (!employee) {
                logger.warn(`Tag ${uid} assigned to non-existent employee ${tag.employee_id}`);
                req.accessStatus = 'DENIED';
                readerAccesLog(req, res, () => {}); // Zaloguj próbę dostępu z tagiem przypisanym do nieistniejącego pracownika
                return res.json({
                    response: 'DENIED',
                    reason: 'Employee not found'
                });
            }
            
            // Możesz dodać tutaj sprawdzenie statusu pracownika (aktywny/nieaktywny)
            // if (!employee.is_active) { ... }
        }

       
        logger.info(`Access granted for tag ${uid}`);
        req.accessStatus = 'ALLOW';
        readerAccesLog(req, res, () => {}); // Zaloguj dostęp
        workTimeTracker(req, res, () => {}); // Śledzenie czasu pracy

        // Immediate response to controller/device: ALLOW (rotation may follow)
        const willAttemptRotation = !!new_secret;
        res.json({
            response: "ALLOW",
            employeeId: tag.employee_id,
            hasSecret: !!tag.tag_secret,
            rotationTriggered: willAttemptRotation
        });

        // If rotation requested, start background blocking transaction that waits for device confirmation
        if (willAttemptRotation) {
            const mqttClient = mqttService.getMqttClient();
            const reader_name = req.headers.reader_name;

            // Non-blocking start
            (async () => {
                const lockAcquired = acquireRotationLock(uid);
                if (!lockAcquired) {
                    logger.warn(`Rotation already in progress for tag ${uid}`);
                    return;
                }
                try {
                    // Optionally resolve device_id for reader_name
                    let device_id = null;
                    try {
                        if (reader_name) {
                            const r = await db.oneOrNone('SELECT device_id FROM readers WHERE reader_name = $1', [reader_name]);
                            if (r) device_id = r.device_id;
                        }
                    } catch (e) {
                        logger.warn(`Failed to resolve device_id for reader ${reader_name}: ${e.message}`);
                    }

                    // Start transaction that keeps row locked until confirm/timeout
                    await db.tx(async (t) => {
                        // Lock the tag row to prevent concurrent modifications
                        const tagRow = await t.oneOrNone('SELECT * FROM tags WHERE tag_id = $1 FOR UPDATE NOWAIT', [uid]);
                        if (!tagRow) {
                            throw new Error(`Tag ${uid} not found when attempting rotation`);
                        }

                        // Wait for device confirmation (default timeout 10s)
                        try {
                                const result = await mqttClient.waitForRotationConfirm(uid, device_id, reader_name, 15000);
                                if (!result || result.success === false) {
                                    throw new Error('Device reported failure or timeout during write');
                                }
                            } catch (err) {
                            logger.warn(`Rotation for tag ${uid} failed or timed out: ${err.message}`);
                            throw err; // cause rollback
                        }

                            // On success, use `new_secret` from request headers as source-of-truth
                            if (!new_secret) {
                                logger.error(`Rotation for tag ${uid} missing new_secret in request headers, cannot commit rotation`);
                                throw new Error('No new_secret provided in request headers to commit');
                            }
                            // Log device payload for diagnostics but DO NOT rely on it for secret value
                            const devicePayloadPreview = (typeof result === 'object' && result.payload) ? JSON.stringify(result.payload).slice(0,300) : null;
                            logger.info(`Rotation for tag ${uid} committing secret from header 'new_secret'. Device payload preview: ${devicePayloadPreview}`);
                            await t.none('UPDATE tags SET tag_secret = $1 WHERE tag_id = $2', [new_secret, uid]);
                            logger.info(`Rotation for tag ${uid} committed in DB`);
                    });
                } catch (error) {
                    logger.error(`Rotation transaction for tag ${uid} failed: ${error.message}`);
                } finally {
                    releaseRotationLock(uid);
                }
            })();
        }

        

    } catch (error) {
        logger.error(`Error checking access for UID ${uid}: ${error.message || error}`);
        res.status(500).json({
            error: 'Database error',
            response: 'DENIED',
            message: error.message || 'Failed to check access'
        });
    }
});


// Endpoint do aktualizacji secret istniejącego tagu (uniwersalny - z autoryzacją i bez)
router.put('/secret-update/:tagId', mqttAuth, updateSecretValidation, validateRequest, async (req, res) => {
    const { tagId } = req.params;
    const { newSecret } = req.body;
    const isControllerRequest = req.headers['x-controller-request'] === 'true';
    
    // Jeśli nie jest to request z kontrolera, sprawdź autoryzację
    if (!isControllerRequest) {
        return res.json({
            error: 'Unauthorized',
            message: 'This endpoint is reserved for internal use by the  controller'
        });
        };
    
    if (!newSecret) {
        return res.status(400).json({
            error: 'Missing parameter',
            message: 'newSecret is required'
        });
    }
    
    try {
        const tag = await db.oneOrNone('SELECT * FROM tags WHERE tag_id = $1', [tagId]);
        
        if (!tag) {
            return res.status(404).json({
                error: 'Tag not found',
                message: 'Tag does not exist'
            });
        }
        const actor = isControllerRequest ? 'RFID controller' : `user ${req.user.user_id}`;
        await db.query('UPDATE tags SET tag_secret = $1 WHERE tag_id = $2', [newSecret, tagId]);
        logger.info(`Secret updated for tag ${tagId} by ${actor}`);

        res.json({
            success: true,
            message: 'Secret updated successfully',
            tagId: tagId
        });
        
    } catch (error) {
        logger.error(`Error updating secret for tag ${tagId}: ${error.message}`);
        res.status(500).json({
            error: 'Database error',
            message: 'Failed to update secret'
        });
    }
});


module.exports = {
   path: '/tags',
    router,
    routeName: 'tags'
}