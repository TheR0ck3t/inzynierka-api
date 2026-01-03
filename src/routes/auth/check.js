const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../../modules/dbModules/db');
const logger = require('../../logger');

router.get('/', async (req, res) => {
  try {
    // Pobierz token z ciasteczka
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(200).json({ isAuthenticated: false });
    }
    
    // Weryfikacja tokena
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Sprawdzenie, czy użytkownik istnieje w bazie
    const user = await db.oneOrNone('SELECT * FROM public.user_data_department WHERE user_id = $1;', [decoded.userId]);
    if (!user) {
      return res.status(200).json({ isAuthenticated: false });
    }

    // Token jest ważny i użytkownik istnieje
    return res.status(200).json({
      isAuthenticated: true,
      user: {
        id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        department_name: user.department_name || null
      }
    });
  } catch (error) {
    logger.error(`Błąd weryfikacji tokena: ${error.message}`);
    
    // Niezależnie od rodzaju błędu, zwracamy status "nie zalogowany"
    return res.status(200).json({ isAuthenticated: false });
  }
});

module.exports = {
  path: '/auth/check',
  router,
  routeName: 'auth-check'
};