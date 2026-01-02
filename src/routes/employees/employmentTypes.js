const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db'); // Import bazy danych
const authToken = require('../../middleware/authToken')
const logger = require('../../logger');

router.get('/list', authToken, async (req, res) => {
    logger.info(`Próba pobrania typów zatrudnienia, użytkownik: ${req.user.email} (ID: ${req.user.user_id}), IP: ${req.ip}`);
    try {
        const data = await db.any('SELECT employment_type_id, employment_type_name, employment_type_code, employment_description, employment_min_age FROM employment_types');
        res.json({
            status: 'success',
            message: 'Fetched all employment types successfully',
            data: data
        });
    } catch (error) {
        logger.error(`Błąd podczas pobierania typów zatrudnienia, użytkownik: ${req.user.email} (ID: ${req.user.user_id}) - ${error.message || error}`);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch employment types',
            error: error.message || error
        });
    }
});

module.exports = {
   path: '/employees/employmentTypes',
    router,
    routeName: 'employmentTypes' 
}