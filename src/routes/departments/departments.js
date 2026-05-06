const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db');
const authToken = require('../../middleware/authMiddleware/authToken');
const logger = require('../../logger');

router.get('/list', authToken('HR', 'IT'), async (req, res) => {
    try {
        const data = await db.any('SELECT department_id, department_name FROM departments ORDER BY department_name');
        console.log(data);
        res.json({
            status: 'success',
            message: 'Fetched all departments successfully',
            data: data
        });
    } catch (error) {
        logger.error(`Błąd podczas pobierania działów: ${error.message || error}`);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch departments',
            error: error.message || error
        });
    }
});

module.exports = {
   path: '/departments',
    router,
    routeName: 'departments'
};