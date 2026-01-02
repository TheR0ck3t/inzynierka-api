const pgp = require('pg-promise')();
const logger = require('../../logger');

const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

const db = pgp(dbConfig);

// Funkcja sprawdzająca połączenie z bazą danych
async function checkConnection() {
    try {
        logger.info('Sprawdzanie połączenia z bazą danych');
        const connection = await db.connect();
        connection.done(); // Zwalnianie połączenia
    } catch (error) {
        logger.error(`Błąd połączenia z bazą danych: ${error.message || error}`);
        process.exit(1); // Zakończenie procesu w przypadku błędu połączenia
    }
}

// Sprawdzanie połączenia przy starcie aplikacji
checkConnection();

module.exports = db;