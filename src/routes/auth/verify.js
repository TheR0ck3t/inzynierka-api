const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db');
const jwt = require('jsonwebtoken');
const logger = require('../../logger');


router.get('/email', async (req, res) => {
    console.log('Verifying email...');
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({
            status: 'error',
            message: 'Token is required'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.EMAIL_VERIFICATION_SECRET);
        console.log(decoded);
        const user_id = decoded.user_id;

        // Zaktualizuj status weryfikacji e-maila w bazie danych
        await db.none('UPDATE users SET is_active = TRUE WHERE user_id = $1', [user_id]);
        logger.info(`E-mail zweryfikowany dla użytkownika ID: ${user_id}`);
        
        // Przekieruj użytkownika do frontendu z komunikatem sukcesu
        const frontendUrl = process.env.FRONTEND_URL;
        res.redirect(`${frontendUrl}/?verified=true`);
    } catch (error) {
        logger.error(`Błąd weryfikacji e-maila: ${error.message || error}`);
        
        // Przekieruj do frontendu z komunikatem błędu
        const frontendUrl = process.env.FRONTEND_URL;
        res.redirect(`${frontendUrl}/?verified=false&error=${encodeURIComponent(error.message || 'Invalid token')}`);
    }
});

module.exports = {
   path: '/auth/verify',
    router,
    routeName: 'verify' 
}