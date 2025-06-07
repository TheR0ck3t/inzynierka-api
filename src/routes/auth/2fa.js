const express = require('express');
const router = express.Router();
const authToken = require('../../middleware/authToken');
const db = require('../../modules/dbModules/db');
const { generateSecret, generateQRCode, verify2FA  } = require('../../modules/2faModules/2fa.js');





router.post('/enable', authToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const secretData= await generateSecret(req.user.email);
        const qrCodeDataUrl = await generateQRCode(secretData.otpauthUrl);

        // Zapisz sekret w bazie danych
        await db.query('UPDATE users SET two_factor_secret = $1 WHERE id = $2', [secretData.secret, userId]);

        res.status(200).json({
            message: '2FA secret generated successfully',
            qrCodeDataUrl,
            secret: secretData.secret,
        });
    } catch (error) {
        console.error('Error generating 2FA secret:', error);
        res.status(500).json({ message: 'Failed to generate 2FA secret' });
    }

});

router.post('/disable', authToken, async (req, res) => {
    const userId = req.user.id;
    try {
        // Usuń sekret 2FA z bazy danych
        await db.query('UPDATE users SET two_factor_secret = NULL WHERE id = $1', [userId]);
        res.status(200).json({ message: '2FA disabled successfully' });
    } catch (error) {
        console.error('Error disabling 2FA:', error);
        res.status(500).json({ message: 'Failed to disable 2FA' });
    }
});

module.exports = {
   path: '/auth/2fa',
    router,
    routeName: '2FA' 
}