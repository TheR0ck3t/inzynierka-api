const logger = require('../../logger');

// Konfiguracja połączenia z bazą danych
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    
    // Connection pool - opcjonalne dostosowanie wydajności
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
};

// Inicjalizacja z obsługą błędów
const initOptions = {
    error(err, e) {
        if (e.cn) {
            logger.error(`Błąd połączenia z bazą: ${err.message}`);
        }
        if (e.query) {
            logger.error(`Błąd zapytania: ${err.message}`);
        }
    }
};

const pgp = require('pg-promise')(initOptions);
const db = pgp(dbConfig);

// Funkcja sprawdzająca połączenie z bazą danych
async function checkConnection() {
    try {
        logger.info('Sprawdzanie połączenia z bazą danych');
        const connection = await db.connect();
        connection.done();
        logger.info('Połączenie z bazą danych OK');
    } catch (error) {
        logger.error(`Błąd połączenia z bazą danych: ${error.message || error}`);
        process.exit(1);
    }
}

// Helper do transakcji z logowaniem
async function transaction(callback) {
    return await db.tx(async (t) => {
        try {
            return await callback(t);
        } catch (error) {
            logger.error(`Błąd w transakcji: ${error.message}`);
            throw error;
        }
    });
}

// Prosty health check
async function healthCheck() {
    try {
        const result = await db.one(`
            SELECT 
                NOW() as current_time,
                EXTRACT(EPOCH FROM (NOW() - pg_postmaster_start_time())) as uptime
        `);
        return {
            status: 'healthy',
            database: dbConfig.database,
            serverTime: result.current_time,
            uptime: parseFloat(result.uptime)
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            database: dbConfig.database,
            error: error.message
        };
    }
}

// Graceful shutdown
async function gracefulShutdown() {
    logger.info('Zamykanie połączeń z bazą danych...');
    try {
        await pgp.end();
        logger.info('Połączenia z bazą zamknięte');
    } catch (error) {
        logger.error(`Błąd podczas zamykania połączeń: ${error.message}`);
    }
}

// Sprawdzanie połączenia przy starcie aplikacji
checkConnection();

module.exports = db;
module.exports.transaction = transaction;
module.exports.healthCheck = healthCheck;
module.exports.gracefulShutdown = gracefulShutdown;