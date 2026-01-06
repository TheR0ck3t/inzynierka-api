const express = require('express');
const authToken = require('../../middleware/authMiddleware/authToken');
const db = require('../../modules/dbModules/db');
const logger = require('../../logger');
const router = express.Router();



router.get('/access-logs', authToken('IT'), async (req, res) => {
    try {
        const data = await db.any('SELECT * FROM access_logs_employee_info');
        console.log(data);
        res.json({
            status: 'success',
            message: 'Fetched access logs successfully',
            data: data
        });
    } catch (error) {
        logger.error(`Błąd podczas pobierania logów dostępu: ${error.message || error}`);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch access logs',
            error: error.message || error
        });
    }
});

module.exports = {
    path: '/security/',
   router,
   routeName: 'tagLogs'
}