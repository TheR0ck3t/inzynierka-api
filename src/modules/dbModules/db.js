const pgp = require('pg-promise')();

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
        const connection = await db.connect();
        connection.done(); // Zwalnianie połączenia
        console.log(`Connected to the database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
    } catch (error) {
        console.error('Database connection failed:', error.message || error);
        process.exit(1); // Zakończenie procesu w przypadku błędu połączenia
    }
}

// Sprawdzanie połączenia przy starcie aplikacji
checkConnection();

module.exports = db;