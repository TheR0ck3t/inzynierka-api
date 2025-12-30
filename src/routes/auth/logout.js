const express = require('express');
const router = express.Router();
const logger = require('../../logger');


router.post('/', (req, res) => {
    logger.info(`Próba wylogowania z IP: ${req.ip}`);
    // Usuwanie ciasteczka tokena
    res.clearCookie('token', { path: '/' });
    res.clearCookie('userId', { path: '/' });
    
    // Wysyłanie odpowiedzi
    res.status(200).json({
        status: 'success',
        message: 'Zostałeś wylogowany pomyślnie.'
    });

});

module.exports = {
   path: '/auth/logout',
    router,
    routeName: 'Logout' 
}