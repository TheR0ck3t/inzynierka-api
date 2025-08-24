module.exports = async (req, res, next) => {
    const apiKey = req.headers['x-mqtt-api-key'];
    if (!apiKey || apiKey !== process.env.MQTT_API_KEY) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
}