const express = require('express');
const authToken = require('../../middleware/authToken');
const db = require('../../modules/dbModules/db');
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
        console.error("Error fetching access logs:", error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch access logs',
            error: error.message || error
        });
    });
});

module.exports = {
   path: '/logs',
    router,
    routeName: 'tagLogs'
}