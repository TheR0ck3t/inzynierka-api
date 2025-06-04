const express = require('express');
const router = express.Router();


router.post('/', (req, res) => {
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