const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db');
const logger = require('../../logger');

// GET /readers - Pobierz zarejestrowane czytniki z bazy
router.get('/list', async (req, res) => {
    try {
        const data = await db.query('SELECT device_id, reader_name FROM readers ORDER BY device_id');
        res.json({ data});
    } catch (error) {
        logger.error(`Error getting readers: ${error.message}`);
        res.status(500).json({ error: 'Failed to get readers' });
    }
});

// POST /readers - Dodaj czytnik do bazy (IT worker kliknął "Add")
router.post('/', async (req, res) => {
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
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { reader_name } = req.body;
    
    if (!reader_name) {
        return res.status(400).json({ error: 'reader_name is required' });
    }
    
    try {
        await db.query(
            'UPDATE readers SET reader_name = @reader_name WHERE device_id = @device_id',
            { device_id: id, reader_name }
        );
        
        logger.info(`Reader updated: ${id} -> ${reader_name}`);
        res.json({ success: true, device_id: id, reader_name });
    } catch (error) {
        logger.error(`Error updating reader: ${error.message}`);
        res.status(500).json({ error: 'Failed to update reader' });
    }
});

// DELETE /api/readers/:id - Usuń czytnik z bazy
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        await db.query('DELETE FROM readers WHERE device_id = @device_id', { device_id: id });
        
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
