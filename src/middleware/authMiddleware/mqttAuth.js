const logger = require('../../logger');

module.exports = async (req, res, next) => {
    logger.info(`mqttAuth middleware: Authenticating MQTT request from IP: ${req.ip}`);
    const apiKey = req.headers['x-mqtt-api-key'];
    if (!apiKey || apiKey !== process.env.MQTT_API_KEY) {
        logger.warn(`mqttAuth middleware: Forbidden MQTT request from IP: ${req.ip}`);
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
}