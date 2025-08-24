const db = require('../modules/dbModules/db');

const logger = require('../logger');

const logAccess = async (req, res, next) => {
    const uid = req.params.uid;
    const reader = req.headers.reader;
    console.log(`logAccess middleware: UID=${uid}, Reader=${reader}`);
    if (!uid) {
        logger.warn('No UID provided in request');
        return next();
    }
    try {
        console.log(`Logging access for UID: ${uid}, Reader: ${reader}`);
        await db.none('INSERT INTO access_logs (tag_id, reader_id) VALUES ($1, $2)', [uid, reader]);
    } catch (error) {
        logger.error(`Error logging access: ${error.message}`);
    }


    next();
};

module.exports = logAccess;
