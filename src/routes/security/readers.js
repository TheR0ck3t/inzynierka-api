const express = require('express');
const authToken = require('../../middleware/authMiddleware/authToken');
const db = require('../../modules/dbModules/db');
const logger = require('../../logger');
const validateRequest = require('../../middleware/validationMiddleware/validateRequest');
const { addReaderValidation, updateReaderValidation } = require('../../validators/readerValidators');
const router = express.Router();


router.get('/', authToken('IT'), async (req, res) => {
    try {
        const readers = await db.any('SELECT * FROM readers');
        res.json({
            status: 'success',
            message: 'Fetched all readers successfully',
            data: readers
        });
    } catch (error) {

        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch readers',
            error: error.message || error
        });
        logger.error(`Error fetching readers: ${error.message || error}`);
    }

});

router.post('/add', authToken('IT'), addReaderValidation, validateRequest, async (req, res) => {
    const { name, location } = req.body;
    
    try {
        if (!name || !location) {
            return res.status(400).json({
                status: 'error',
                message: 'Name and location are required'
            });
        }
        
        const result = await db.one(
            'INSERT INTO readers (name, location) VALUES ($1, $2) RETURNING reader_id',
            [name, location]
        );
        
        logger.info(`Dodano czytnik: ${name} w lokalizacji ${location}`);
        res.json({
            status: 'success',
            message: 'Reader added successfully',
            reader_id: result.reader_id
        });
    } catch (error) {
        logger.error(`Błąd dodawania czytnika: ${error.message || error}`);
        res.status(500).json({
            status: 'error',
            message: 'Failed to add reader',
            error: error.message || error
        });
    }
});

router.put('/update/:id', authToken('IT'), updateReaderValidation, validateRequest, async(req, res) => {
    const readerId = req.params.reader_id;
    const updates = req.body;
    try {
        const allowedFields = ['name', 'location', 'status'];
    const fields = Object.keys(updates).filter(field => allowedFields.includes(field));
        
        if (fields.length > 0) {
            const setStatements = fields.map((field, index) => `${field} = $${index + 1}`);
            const query = `UPDATE readers SET ${setStatements.join(', ')} WHERE reader_id = $${fields.length + 1} RETURNING *`;
            const values = [...fields.map(field => updates[field]), readerId];
            const updatedReader = await db.one(query, values);
            return res.json({
                status: 'success',
                message: `Czytnik ${req.params.id} zaktualizowany pomyślnie`,
                data: updatedReader
            });
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'No valid fields to update'
            });
        }
    } catch (error) {
        logger.error(`Błąd aktualizacji czytnika: ${error.message || error}`);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update reader',
            error: error.message || error
        });
    }
});

router.delete('/delete/:id', authToken('IT'), async (req, res) => {
    const readerId = req.params.id;
    try {
        const result = await db.result('DELETE FROM readers WHERE reader_id = $1', [readerId]);
        if (result.rowCount === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Reader not found'
            });
        }
        res.json({
            status: 'success',
            message: 'Reader deleted successfully'
        });
        logger.info(`Czytnik ID: ${readerId} usunięty przez użytkownika: ${req.user.email} (ID: ${req.user.user_id})`);
    } catch (error) {
        logger.error(`Błąd usuwania czytnika: ${error.message || error}`);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete reader',
            error: error.message || error
        });
    }
});

        


module.exports = {
   path: '/security/readers',
   router,
   routeName: 'readers' 
}