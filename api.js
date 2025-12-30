require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const app = express();

// Opcjonalna konfiguracja SSL - jeśli certyfikaty są dostępne, użyj HTTPS, w przeciwnym razie HTTP
let server;
if (process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
    try {
        const sslOptions = {
            key: fs.readFileSync(process.env.SSL_KEY_PATH),
            cert: fs.readFileSync(process.env.SSL_CERT_PATH)
        };
        server = https.createServer(sslOptions, app);
        console.log('✅ SSL certificates loaded - using HTTPS');
    } catch (error) {
        console.log('⚠️  SSL certificates not found or invalid - falling back to HTTP');
        console.log('   Error:', error.message);
        server = http.createServer(app);
    }
} else {
    console.log('ℹ️  SSL not configured - using HTTP');
    server = http.createServer(app);
}

const PORT = process.env.PORT;
const logger = require('./src/logger'); // Dodanie loggera
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Import serwisów
const mqttService = require('./src/services/mqttService');
const webSocketService = require('./src/services/websocket');
const statsScheduler = require('./src/services/statsScheduler');

// Konfiguracja proxy - ufaj nagłówkom proxy aby poprawnie odczytywać IP klienta
// W produkcji: ustaw liczbę proxy (hop count) lub konkretne trusted proxy IPs
// W developmencie: ufaj localhost
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : true);

// Middleware: Umożliwienie parsowania JSON i URL-encoded
app.use(express.json()); // Parsowanie ciała zapytania w formacie JSON
app.use(express.urlencoded({ extended: true })); // Parsowanie URL-encoded

app.use(cookieParser()); // Parsowanie ciasteczek
app.use(cors(
    {
        origin: process.env.FRONTEND_URL, // Adres klienta, który ma dostęp do API
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Dozwolone metody
        allowedHeaders: ['Content-Type', 'Authorization'], // Dozwolone nagłówki
        credentials: true // Umożliwienie przesyłania ciasteczek
    }
)); // Umożliwienie CORS

// Wczytywanie tras
const routesPath = path.join(__dirname, './src/routes');
const loadRoutes = (dirPath) => {
    fs.readdirSync(dirPath).forEach(file => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            loadRoutes(fullPath);
        } else {
            const { path: routePath, router, routeName } = require(fullPath);
            if (router && routePath) {
                app.use(routePath, router);
                const relativePath = path.relative(routesPath, fullPath);
                logger.info(`Loaded route: ${routeName} at ${routePath} from ${relativePath}`);
                console.log(`Loaded route: ${routeName}\nPath: ${routePath}\nFrom file: ${relativePath}\n`);
            } else {
                logger.error(`Error loading route from file: ${fullPath}`);
                console.log(`Error loading route from file: ${fullPath}`);
            }
        }
    });
};

loadRoutes(routesPath);

// Inicjalizacja serwisów - użyj MqttService singleton
const { mqttClient, io } = mqttService.initialize(server);

// Zintegruj dodatkowe funkcje WebSocket
webSocketService.initialize(io, mqttClient);

// Inicjalizacja scheduled jobs dla statystyk
statsScheduler.init();

// Start serwera
server.listen(PORT, () => {
    logger.info(`API server started on port ${PORT}`);
    console.log('API server started on port ' + PORT);
});

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('SIGINT received: closing server');
    statsScheduler.stop();
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    logger.info('SIGTERM received: closing server');
    statsScheduler.stop();
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});