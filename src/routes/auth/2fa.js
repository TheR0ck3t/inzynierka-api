const express = require('express');
const router = express.Router();
const authToken = require('../../middleware/authMiddleware/authToken');
const db = require('../../modules/dbModules/db');
const logger = require('../../logger');
const { generateSecret, generateQRCode, verify2FA  } = require('../../modules/2faModules/2fa');
const validateRequest = require('../../middleware/validationMiddleware/validateRequest');





router.get('/status', authToken(), validateRequest, async (req, res) => {
    logger.info(`Sprawdzanie statusu 2FA dla użytkownika: ${req.user.email} (ID: ${req.user.user_id})`);
    const userId = req.user.user_id;
    try {
        const user = await db.one('SELECT two_factor_secret FROM users WHERE user_id = $1', [userId]);
        const is2FAEnabled = !!user.two_factor_secret;
        res.status(200).json({ 
            status: is2FAEnabled 
        });
    } catch (error) {
        logger.error(`Błąd sprawdzania statusu 2FA dla użytkownika: ${req.user.email} (ID: ${req.user.user_id}): ${error.message}`);
        res.status(500).json({ message: 'Failed to check 2FA status' });
    }
});

router.post('/enable', authToken(), validateRequest, async (req, res) => {
    logger.info(`Włączanie 2FA dla użytkownika: ${req.user.email} (ID: ${req.user.user_id})`);
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
        logger.error(`Błąd generowania sekretu 2FA dla użytkownika: ${req.user.email} (ID: ${req.user.user_id}): ${error.message}`);
        res.status(500).json({ message: 'Failed to generate 2FA secret' });
    }

});

router.post('/disable', authToken(), validateRequest, async (req, res) => {
    logger.info(`Wyłączanie 2FA dla użytkownika: ${req.user.email} (ID: ${req.user.user_id})`);
    const userId = req.user.user_id;
    try {
        // Usuń sekret 2FA z bazy danych
        await db.query('UPDATE users SET two_factor_secret = NULL WHERE user_id = $1', [userId]);
        res.status(200).json({ message: '2FA disabled successfully' });
    } catch (error) {
        logger.error(`Błąd wyłączania 2FA dla użytkownika: ${req.user.email} (ID: ${req.user.user_id}): ${error.message}`);
        res.status(500).json({ message: 'Failed to disable 2FA' });
    }
});

module.exports = {
   path: '/auth/2fa',
    router,
    routeName: '2FA' 
}