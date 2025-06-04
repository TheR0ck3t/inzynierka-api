const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../../modules/dbModules/db');

router.get('/', async (req, res) => {
  try {
    console.log('Sprawdzanie autoryzacji użytkownika...');
    // Pobierz token z ciasteczka
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(200).json({ isAuthenticated: false });
    }
    
    // Weryfikacja tokena
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Sprawdzenie, czy użytkownik istnieje w bazie
    const user = await db.oneOrNone('SELECT id, email, first_name, last_name FROM users WHERE id = $1', [decoded.userId]);
    
    if (!user) {
      return res.status(200).json({ isAuthenticated: false });
    }

    console.log('Token zweryfikowany, użytkownik istnieje:', user.email);
    
    // Token jest ważny i użytkownik istnieje
    return res.status(200).json({
      isAuthenticated: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });

    console.log('Użytkownik jest zalogowany:', user.email);
    
  } catch (error) {
    console.error('Błąd weryfikacji tokena:', error);
    
    // Niezależnie od rodzaju błędu, zwracamy status "nie zalogowany"
    return res.status(200).json({ isAuthenticated: false });
  }
});

module.exports = {
  path: '/auth/check',
  router,
  routeName: 'auth-check'
};