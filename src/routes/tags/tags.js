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
// Tymczasowe przechowywanie rotacji sekretów (rotation_id -> { tagId, newSecret, expiresAt })
let pendingRotations = new Map();

// Cleanup wygasłych pendingRotations co 10s
setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of pendingRotations.entries()) {
        if (entry.expiresAt <= now) {
            pendingRotations.delete(id);
            logger.info(`Pending rotation expired and removed: ${id}`);
        }
    }
}, 10000);

function generateSecret12() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charsLen = characters.length;
    let secret = '';
    const buf = crypto.randomBytes(12);
    for (let i = 0; i < 12; i++) {
        secret += characters[buf[i] % charsLen];
    }
    return secret;
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

router.get('/check-access/:uid', mqttAuth, checkAccessValidation, validateRequest, async (req, res) => {
    const uid = req.params.uid;
    const providedSecret = req.headers.secret // Secret może być w query lub header

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
            if (!providedSecret) {
                logger.warn(`Tag ${uid} requires secret but none provided`);
                req.accessStatus = 'DENIED';
                readerAccesLog(req, res, () => {}); // Zaloguj próbę dostępu bez secret
                return res.json({
                    response: 'DENIED',
                    reason: 'Secret required'
                });
            }
            
            if (tag.tag_secret !== providedSecret) {
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
        // Przyznaj dostęp i przygotuj rotację sekretu wygenerowanego po stronie serwera
        const rotationId = `rot_${Date.now()}_${Math.floor(Math.random()*100000)}`;
        const newSecret = generateSecret12();
        // Oblicz HMAC dla rotacji (do weryfikacji przy potwierdzeniu)
        const hmacKey = process.env.ROTATION_HMAC_KEY || 'default_rotation_key';
        const rotHmac = crypto.createHmac('sha256', hmacKey).update(`${rotationId}|${newSecret}`).digest('hex');
        // Zapisz rotację tymczasowo (ważna przez 30s)
        pendingRotations.set(rotationId, {
            tagId: uid,
            newSecret: newSecret,
            rotHmac: rotHmac,
            expiresAt: Date.now() + 30000
        });

        req.accessStatus = 'ALLOW';
        readerAccesLog(req, res, () => {}); // Zaloguj dostęp
        workTimeTracker(req, res, () => {}); // Śledzenie czasu pracy

        res.json({
            response: "ALLOW",
            employeeId: tag.employee_id,
            hasSecret: !!tag.tag_secret,
            rotation_id: rotationId,
            secret: newSecret,
            rotation_hmac: rotHmac
        });
        

    } catch (error) {
        logger.error(`Error checking access for UID ${uid}: ${error.message || error}`);
        res.status(500).json({
            error: 'Database error',
            response: 'DENIED',
            message: error.message || 'Failed to check access'
        });
    }
});

// Helper: apply tag secret and log actor
async function applyTagSecret(tagId, newSecret, actor) {
    await db.none('UPDATE tags SET tag_secret = $1 WHERE tag_id = $2', [newSecret, tagId]);
    logger.info(`Secret updated for tag ${tagId} by ${actor}`);
}

// Endpoint do aktualizacji secret istniejącego tagu (uniwersalny - z autoryzacją i bez)
router.put('/secret-update/:tagId', mqttAuth, updateSecretValidation, validateRequest, async (req, res) => {
    const { tagId } = req.params;
    const { newSecret } = req.body;
    const isControllerRequest = req.headers['x-controller-request'] === 'true';
    
    // Jeśli nie jest to request z kontrolera, sprawdź autoryzację
    if (!isControllerRequest) {
        authToken(req, res, () => {
            // Kontynuuj jeśli autoryzacja przeszła
        });
        if (!req.user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }
    }
    
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

// Endpoint przyjmujący potwierdzenie rotacji sekretu z urządzenia (przez MQTT bridge)
router.post('/rfid/rotation-confirm', mqttAuth, async (req, res) => {
    const { rotation_id, uid, device_id, source } = req.body;

    if (!rotation_id || !uid) {
        return res.status(400).json({ error: 'Missing rotation_id or uid' });
    }

    try {
        const pending = pendingRotations.get(rotation_id);
        if (!pending) {
            return res.status(404).json({ error: 'Rotation not found or expired' });
        }

        if (pending.tagId !== uid) {
            return res.status(400).json({ error: 'Rotation UID mismatch' });
        }

        // Weryfikuj HMAC jeśli został przesłany
        const providedHmac = req.body.rotation_hmac;
        if (!providedHmac || providedHmac !== pending.rotHmac) {
            logger.warn(`Rotation HMAC mismatch for ${rotation_id} (provided: ${providedHmac})`);
            return res.status(401).json({ error: 'Invalid rotation_hmac' });
        }

        // Zaktualizuj sekret w bazie danych
        await db.none('UPDATE tags SET tag_secret = $1 WHERE tag_id = $2', [pending.newSecret, uid]);

        // Usuń wpis pending
        pendingRotations.delete(rotation_id);

        logger.info(`Rotation confirmed for ${uid} (rotation_id=${rotation_id}) by device ${device_id}`);

        res.json({ success: true, message: 'Rotation applied' });
    } catch (error) {
        logger.error(`Error confirming rotation: ${error.message}`);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// Endpoint przyjmujący informację o timeout'cie rotacji (urządzenie nie otrzymało odpowiedzi)
router.post('/rfid/rotation-timeout', mqttAuth, async (req, res) => {
    const { uid, device_id, rotation_id } = req.body;

    if (!uid) {
        return res.status(400).json({ error: 'Missing uid' });
    }

    try {
        let removed = [];

        if (rotation_id) {
            const pending = pendingRotations.get(rotation_id);
            if (pending && pending.tagId === uid) {
                pendingRotations.delete(rotation_id);
                removed.push(rotation_id);
            }
        } else {
            // usuń wszystkie pending rotacje dla tego taga
            for (const [rid, entry] of pendingRotations.entries()) {
                if (entry.tagId === uid) {
                    pendingRotations.delete(rid);
                    removed.push(rid);
                }
            }
        }

        if (removed.length === 0) {
            logger.info(`Rotation-timeout received for ${uid} but no pending rotations found`);
            return res.json({ success: true, message: 'No pending rotations to cancel', removed: [] });
        }

        logger.info(`Cancelled pending rotations for ${uid} due to device timeout: ${removed.join(', ')}`);
        return res.json({ success: true, message: 'Pending rotations cancelled', removed: removed });
    } catch (error) {
        logger.error(`Error handling rotation-timeout for ${uid}: ${error.message}`);
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

module.exports = {
   path: '/tags',
    router,
    routeName: 'tags'
}