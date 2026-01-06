const express = require('express');
const router = express.Router();
const authToken = require('../../middleware/authMiddleware/authToken');
const db = require('../../modules/dbModules/db');
const logger = require('../../logger');

// Endpoint health check - sprawdza status API i bazy danych
router.get('/', authToken('IT'), async (req, res) => {
    try {
        // Status API
        const apiStatus = {
            status: 'healthy',
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        };

        // Status bazy danych
        const dbHealth = await db.healthCheck();
        
        const dbStatus = {
            status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: dbHealth.uptime || 0,
            database: dbHealth
        };
        
        const healthStatus = [
            { service: {api: apiStatus }}, 
            { service: {db: dbStatus} }
        ];
        res.json({
            status: 'success',
            data: healthStatus
        })
    } catch (error) {
        logger.error(`Health check error: ${error.message}`);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

module.exports = {
    path: '/health',
    router,
    routeName: 'health'
};
