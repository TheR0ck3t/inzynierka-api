const express = require('express'); // Import frameworka Express
const router = express.Router(); // Utworzenie routera dla endpointów związanych z czytnikami
const db = require('../../modules/dbModules/db'); // Import modułu do obsługi bazy danych
const authToken = require('../../middleware/authMiddleware/authToken'); // Middleware do autoryzacji tokenem JWT
const { addReaderValidation, updateReaderValidation, deleteReaderValidation } = require('../../validators/readerValidators'); // Import walidatorów dla danych czytnika
const validateRequest = require('../../middleware/validationMiddleware/validateRequest'); // Middleware do obsługi wyników walidacji danych wejściowych
const logger = require('../../logger'); // Import modułu do logowania zdarzeń i błędów

// GET /readers - Pobierz zarejestrowane czytniki z bazy
router.get('/list', authToken('IT'), async (req, res) => {
    try {
        const data = await db.any('SELECT device_id, reader_name FROM readers ORDER BY device_id');
        res.json({ data});
    } catch (error) {
        logger.error(`Error getting readers: ${error.message}`);
        res.status(500).json({ error: 'Failed to get readers' });
    }
});

// POST /readers - Dodaj czytnik do bazy (IT worker kliknął "Add")
router.post('/', authToken('IT'), addReaderValidation, validateRequest, async (req, res) => {
    const { device_id, reader_name } = req.body;
    console.log(req.body)
    
    if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
    }
    
    try {
        await db.query(
            'INSERT INTO readers (device_id, reader_name) VALUES ($1, $2)',
            [device_id, reader_name]
        );
        
        logger.info(`Reader registered: ${device_id} (${reader_name})`);
        res.json({ success: true, device_id, reader_name });
    } catch (error) {
        logger.error(`Error registering reader: ${error.message}`);
        res.status(500).json({ error: 'Failed to register reader' });
    }
});

// PUT /api/readers/:id - Zmień nazwę czytnika
router.put('/:id', authToken('IT'), updateReaderValidation, validateRequest, async (req, res) => {
    const { id } = req.params;
    const { reader_name } = req.body;
    
    if (!reader_name) {
        return res.status(400).json({ error: 'reader_name is required' });
    }
    
    try {
        await db.query(
            'UPDATE readers SET reader_name = $1 WHERE device_id = $2',
            [reader_name, id]
        );
        
        logger.info(`Reader updated: ${id} -> ${reader_name}`);
        res.json({ success: true, device_id: id, reader_name });
    } catch (error) {
        logger.error(`Error updating reader: ${error.message}`);
        res.status(500).json({ error: 'Failed to update reader' });
    }
});

// DELETE /api/readers/:id - Usuń czytnik z bazy
router.delete('/:id', authToken('IT'), deleteReaderValidation, validateRequest, async (req, res) => {
    const { id } = req.params;
    
    try {
        await db.query('DELETE FROM readers WHERE device_id = $1', [id]);
        
        logger.info(`Reader deleted: ${id}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`Error deleting reader: ${error.message}`);
        res.status(500).json({ error: 'Failed to delete reader' });
    }
});

module.exports = {
    path: '/readers',
    router,
    routeName: 'Readers Management'
};
