const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db'); // Import bazy danych
const mqttService = require('../../services/mqttService'); // Import MQTT service
const logger = require('../../logger');
const authToken = require('../../middleware/authToken'); // Import middleware auth

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

router.post('/add', authToken, async (req, res) => {
    const tag = req.body.tag;
    
    if (!tag) {
        return res.status(400).json({ message: 'Tag is required' });
    }

    try {
        const existingTag = await db.oneOrNone('SELECT * FROM tags WHERE "tag_id" = $1', [tag]);
        
        if (!existingTag) {
            // Tag nie istnieje, wstaw go
            await db.query('INSERT INTO tags ("tag_id") VALUES ($1)', [tag]);
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
router.post('/rfid/enroll', authToken, async (req, res) => {
    const { reader = 'mainEntrance', employeeId } = req.body;
    logger.info(`Starting RFID enrollment for employee: ${employeeId} on reader: ${reader} by user: ${req.user.user_id}`);

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
router.post('/rfid/save', async (req, res) => {
    const { reader, tagId, sessionId } = req.body;
    
    logger.info(`Saving RFID card: reader=${reader}, tagId=${tagId}, sessionId=${sessionId}`);
    
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
        } else {
            // Tag nie istnieje, dodaj go z employeeId
            logger.info(`Inserting new tag with employeeId: ${employeeId}`);
            await db.query('INSERT INTO tags (tag_id, employee_id) VALUES ($1, $2)', [tagId, employeeId]);
        }
        
        // Przypisz kartę do pracownika
        await db.query('UPDATE employees SET keycard_id = $1 WHERE employee_id = $2', [tagId, employeeId]);
        
        // Usuń sesję enrollment
        enrollmentSessions.delete(reader);
        
        logger.info(`Card ${tagId} assigned to employee ${employeeId}`);
        res.json({
            success: true,
            message: 'Card enrolled and assigned successfully',
            tagId: tagId,
            employeeId: employeeId
        });
        
    } catch (error) {
        logger.error(`Error saving enrolled card: ${error.message || error}`);
        res.status(500).json({
            error: 'Database error',
            message: error.message || 'Failed to save enrolled card'
        });
    }
});

router.delete('/delete/:tagId', authToken, async (req, res) => {
    const { tagId } = req.params;

    logger.info(`Deleting RFID card: tagId=${tagId} by user: ${req.user.user_id}`);

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

module.exports = {
   path: '/tags',
    router,
    routeName: 'tags'
}