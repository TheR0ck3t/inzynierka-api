require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const app = express();
const logger = require('./src/logger');
const httpLogger = require('./src/middleware/loggingMiddleware/httpLogger');

// Opcjonalna konfiguracja SSL - jeśli certyfikaty są dostępne, użyj HTTPS, w przeciwnym razie HTTP
let server;
if (process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
    try {
        const sslOptions = {
            key: fs.readFileSync(process.env.SSL_KEY_PATH),
            cert: fs.readFileSync(process.env.SSL_CERT_PATH)
        };
        server = https.createServer(sslOptions, app);
        console.log('✅  SSL configured - using HTTPS');
        logger.info('Certyfikaty SSL znalezione - uruchamianie serwera HTTPS');
    } catch (error) {
        console.log('⚠️  SSL certificates not found or invalid - falling back to HTTP');
        logger.warn(`Błąd podczas ładowania certyfikatów SSL: ${error.message}. Uruchamianie serwera HTTP zamiast HTTPS.`);
        server = http.createServer(app);
    }
} else {
    console.log('ℹ️  SSL not configured - using HTTP');
    server = http.createServer(app);
}

const PORT = process.env.PORT;
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Import serwisów
const mqttService = require('./src/services/mqttService/mqttService');
const webSocketService = require('./src/services/webSocketService/websocket');
const statsScheduler = require('./src/services/statsService/statsScheduler');

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

// Middleware: Logger HTTP - logowanie wszystkich przychodzących żądań
app.use((req, res, next) => {
    // Wykluczenia
    if (req.method === 'OPTIONS' || req.path === '/health') {
        return next();
    }
    return httpLogger(req, res, next);
});

// Wczytywanie tras
const routesPath = path.join(__dirname, './src/routes');
const loadRoutes = (dirPath) => {
    try {
        const files = fs.readdirSync(dirPath);
        
        files.forEach(file => {
            const fullPath = path.join(dirPath, file);
            const stats = fs.statSync(fullPath);
            
            // Rekurencyjne przeszukiwanie podkatalogów
            if (stats.isDirectory()) {
                loadRoutes(fullPath);
                return;
            }
            
            // Pomijaj pliki nie będące modułami JavaScript
            if (!file.endsWith('.js')) {
                return;
            }
            
            try {
                const routeModule = require(fullPath);
                const { path: routePath, router, routeName } = routeModule;
                
                // Walidacja wymaganych pól
                if (!router || !routePath || !routeName) {
                    logger.error(`Moduł trasy nie posiada wymaganych eksportów (path/router/routeName): ${fullPath}`);
                    console.error(`Błąd: Brak wymaganych eksportów w pliku: ${fullPath}`);
                    return;
                }
                
                // Rejestracja trasy
                app.use(routePath, router);
                
                const relativePath = path.relative(routesPath, fullPath);
                logger.info(`Wczytano trasę: ${routeName} pod adresem ${routePath} z pliku ${relativePath}`);
                console.log(`Wczytano trasę: ${routeName}\nŚcieżka: ${routePath}\nZ pliku: ${relativePath}\n`);
                
            } catch (error) {
                logger.error(`Nie udało się załadować trasy z pliku ${fullPath}: ${error.message}`);
                console.error(`Błąd ładowania trasy z ${fullPath}: ${error.message}`);
            }
        });
        
    } catch (error) {
        logger.error(`Błąd odczytu katalogu ${dirPath}: ${error.message}`);
        console.error(`Błąd odczytu katalogu ${dirPath}: ${error.message}`);
    }
};

// Załaduj wszystkie trasy
try {
    loadRoutes(routesPath);
    logger.info('Zakończono ładowanie tras');
} catch (error) {
    logger.error(`Krytyczny błąd podczas ładowania tras: ${error.message}`);
    process.exit(1);
}

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