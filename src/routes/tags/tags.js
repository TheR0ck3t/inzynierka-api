const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db'); // Import bazy danych
const mqttService = require('../../services/mqttService/mqttService'); // Import MQTT service
const logger = require('../../logger');
const authToken = require('../../middleware/authMiddleware/authToken'); // Import middleware auth
const mqttAuth = require('../../middleware/authMiddleware/mqttAuth'); // Import MQTT auth middleware
const readerAccesLog = require('../../middleware/loggingMiddleware/readerAccesLog'); // Import middleware readerAccesLog
const workTimeTracker = require('../../middleware/statsMiddleware/workTimeTracker'); // Import middleware workTimeTracker
const { addTagValidation, deleteTagValidation, enrollRfidValidation, updateSecretValidation, saveRfidValidation, checkAccessValidation } = require('../../validators/validators');
const validateRequest = require('../../middleware/validationMiddleware/validateRequest');
// Tymczasowe przechowywanie danych enrollment
let enrollmentSessions = new Map();

router.get('/list', authToken, async (req, res) => {
    try {
        const data = await db.query('SELECT * FROM tags');
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

router.post('/add', authToken, addTagValidation, validateRequest, async (req, res) => {
    const tag = req.body.tag;
    const tagSecret = req.body.secret;

    if (!tag || !tagSecret) {
        return res.status(400).json({ message: 'Tag and secret are required' });
    }

    try {
        const existingTag = await db.oneOrNone('SELECT * FROM tags WHERE "tag_id" = $1', [tag]);
        
        if (!existingTag) {
            // Tag nie istnieje, wstaw go
            await db.query('INSERT INTO tags ("tag_id", "tag_secret") VALUES ($1, $2)', [tag, tagSecret]);
            res.status(201).json({ message: 'Tag added successfully' });
        } else {
            // Tag już istnieje
            res.status(400).json({ message: 'Tag already exists' });
        }
    } catch (error) {
        logger.error(`Error adding tag: ${error.message || error}`);
        res.status(500).json({
            status: 'error',
            message: 'Failed to add tag.',
            error: error.message || error
        });
    }
});



// Endpoint POST /rfid/enroll - główny endpoint do rozpoczęcia enrollment
router.post('/rfid/enroll', authToken, enrollRfidValidation, validateRequest, async (req, res) => {
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
            reader: reader,
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

router.delete('/delete/:tagId', authToken, deleteTagValidation, validateRequest, async (req, res) => {
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

        req.accessStatus = 'ALLOW';
        readerAccesLog(req, res, () => {}); // Zaloguj dostęp
        workTimeTracker(req, res, () => {}); // Śledzenie czasu pracy

        res.json({
            response: "ALLOW",
            employeeId: tag.employee_id,
            hasSecret: !!tag.tag_secret
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
        
        await db.query('UPDATE tags SET tag_secret = $1 WHERE tag_id = $2', [newSecret, tagId]);
        
        const actor = isControllerRequest ? 'RFID controller' : `user ${req.user.user_id}`;
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