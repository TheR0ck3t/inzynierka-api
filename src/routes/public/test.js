const express = require('express');
const router = express.Router();

router.post('/test', (req, res) => {
    const { message } = req.body;
    console.log("✅ Odebrana wiadomość:", message);

    // Odpowiedź do klienta
    res.json({ success: true, receivedMessage: message });
});

module.exports = {
    path: '/api',
    router,
    routeName: 'test'
};