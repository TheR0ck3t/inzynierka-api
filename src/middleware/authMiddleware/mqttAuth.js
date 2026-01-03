const logger = require('../../logger');

module.exports = async (req, res, next) => {
    const apiKey = req.headers['x-mqtt-api-key'];
    if (!apiKey || apiKey !== process.env.MQTT_API_KEY) {
        logger.warn('MQTT authentication failed - invalid or missing API key');
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
}