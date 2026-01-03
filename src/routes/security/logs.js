const express = require('express');
const authToken = require('../../middleware/authMiddleware/authToken');
const db = require('../../modules/dbModules/db');
const logger = require('../../logger');
const router = express.Router();



router.get('/access-logs', authToken, (req, res) => {
    db.any('SELECT * FROM access_logs_employee_info')
    .then(data => {
        res.json({
            status: 'success',
            message: 'Fetched access logs successfully',
            data: data
        });
    })
    .catch(error => {
        logger.error(`Błąd podczas pobierania logów dostępu: ${error.message || error}`);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch access logs',
            error: error.message || error
        });
    });
});

module.exports = {
   path: '/security/logs',
    router,
    routeName: 'tagLogs'
}