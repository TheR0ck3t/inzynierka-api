const express = require('express');
const router = express.Router();
const webSocketService = require('../../services/websocket');
const logger = require('../../logger');

// Route do sprawdzania statusu WebSocket connections
router.get('/status', (req, res) => {
    try {
        const status = webSocketService.getConnectionStatus();
        logger.info('WebSocket status requested');
        
        res.json({
            success: true,
            data: status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error getting WebSocket status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get WebSocket status',
            error: error.message
        });
    }
});

// Route do ręcznego wyzwalania skanowania karty (dla testów)
router.post('/trigger-scan', (req, res) => {
    try {
        const { deviceId } = req.body;
        
        const success = webSocketService.triggerCardScan(deviceId);
        
        if (success) {
            logger.info(`Card scan triggered for device: ${deviceId || 'default'}`);
            res.json({
                success: true,
                message: 'Card scan triggered successfully',
                deviceId: deviceId || null
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to trigger card scan - no ESP32 connected'
            });
        }
    } catch (error) {
        logger.error('Error triggering card scan:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger card scan',
            error: error.message
        });
    }
});

// Route do broadcastowania wiadomości do wszystkich przeglądarek (dla testów)
router.post('/broadcast', (req, res) => {
    try {
        const { message, action } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Message is required'
            });
        }

        const broadcastData = {
            action: action || 'test_message',
            message,
            timestamp: new Date().toISOString()
        };

        webSocketService.broadcastToBrowsers(broadcastData);
        
        logger.info('Manual broadcast sent:', broadcastData);
        
        res.json({
            success: true,
            message: 'Broadcast sent successfully',
            data: broadcastData
        });
    } catch (error) {
        logger.error('Error sending broadcast:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send broadcast',
            error: error.message
        });
    }
});

// Route do symulacji skanowania karty (dla testów)
router.post('/simulate-scan', (req, res) => {
    try {
        const { uid, deviceId } = req.body;
        
        if (!uid) {
            return res.status(400).json({
                success: false,
                message: 'UID is required'
            });
        }

        const cardData = {
            uid,
            deviceId: deviceId || 'simulator',
            source: 'manual_simulation'
        };

        webSocketService.notifyCardAdded(cardData);
        
        logger.info('Card scan simulated:', cardData);
        
        res.json({
            success: true,
            message: 'Card scan simulated successfully',
            data: cardData
        });
    } catch (error) {
        logger.error('Error simulating card scan:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to simulate card scan',
            error: error.message
        });
    }
});

module.exports = {
    path: '/api/websocket',
    router,
    routeName: 'WebSocket API Routes'
};
