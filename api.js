require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT;
const logger = require('./src/logger'); // Dodanie loggera
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Import serwisów
const mqttService = require('./src/services/mqttService');
const webSocketService = require('./src/services/websocket');
const db = require('./src/modules/dbModules/db'); // Import modułu bazy danych


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

// Start serwera
server.listen(PORT, () => {
    logger.info(`API server started on port ${PORT}`);
    console.log('API server started on port ' + PORT);
});