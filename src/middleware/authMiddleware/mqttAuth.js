const { header } = require('express-validator'); // Import funkcji do walidacji nagłówków HTTP z biblioteki express-validator
const logger = require('../../logger');

// Middleware do autoryzacji kontrolera IoT za pomocą klucza API
module.exports = async (req, res, next) => {
    const apiKey = req.headers['x-mqtt-api-key']; // Pobranie klucza API z niestandardowego nagłówka
    if (!apiKey || apiKey !== process.env.MQTT_API_KEY) {
        logger.warn('MQTT authentication failed - invalid or missing API key'); // Logowanie nieudanej próby autoryzacji
        return res.status(403).json({ error: 'Forbidden' }); // Odpowiedź 403 Forbidden, jeśli klucz API jest nieprawidłowy lub nie został dostarczony
    }
    next();
}
