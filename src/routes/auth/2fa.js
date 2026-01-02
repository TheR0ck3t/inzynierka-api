const express = require('express');
const router = express.Router();
const authToken = require('../../middleware/authToken');
const db = require('../../modules/dbModules/db');
const logger = require('../../logger');
const { generateSecret, generateQRCode, verify2FA  } = require('../../modules/2faModules/2fa.js');
const { enable2FAValidation, disable2FAValidation } = require('../../validators/validators.js');
const validateRequest = require('../../middleware/validateRequest');





router.post('/enable', authToken, enable2FAValidation, validateRequest, async (req, res) => {
    logger.info(`Próba włączenia 2FA, użytkownik: ${req.user.email} (ID: ${req.user.user_id}), IP: ${req.ip}`);
    const userId = req.user.user_id;
    try {
        const secretData= await generateSecret(req.user.email);
        const qrCodeDataUrl = await generateQRCode(secretData.otpauthUrl);

        // Zapisz sekret w bazie danych
        await db.query('UPDATE users SET two_factor_secret = $1 WHERE user_id = $2', [secretData.secret, userId]);
        logger.info(`2FA secret saved for user: ${req.user.email} (ID: ${req.user.user_id})`);
        res.status(200).json({
            message: '2FA secret generated successfully',
            qrCodeDataUrl,
            secret: secretData.secret,
        });
    } catch (error) {
        logger.error(`Błąd generowania sekretu 2FA dla użytkownika: ${req.user.email} (ID: ${req.user.user_id}), IP: ${req.ip} - ${error.message}`);
        res.status(500).json({ message: 'Failed to generate 2FA secret' });
    }

});

router.post('/disable', authToken, disable2FAValidation, validateRequest, async (req, res) => {
    logger.info(`Próba wyłączenia 2FA, użytkownik: ${req.user.email} (ID: ${req.user.user_id}), IP: ${req.ip}`);
    const userId = req.user.user_id;
    try {
        // Usuń sekret 2FA z bazy danych
        await db.query('UPDATE users SET two_factor_secret = NULL WHERE user_id = $1', [userId]);
        res.status(200).json({ message: '2FA disabled successfully' });
    } catch (error) {
        logger.error(`Błąd wyłączania 2FA dla użytkownika: ${req.user.email} (ID: ${req.user.user_id}), IP: ${req.ip} - ${error.message}`);
        res.status(500).json({ message: 'Failed to disable 2FA' });
    }
});

module.exports = {
   path: '/auth/2fa',
    router,
    routeName: '2FA' 
}