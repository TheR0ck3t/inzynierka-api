const jwt = require('jsonwebtoken');
const db = require('../../modules/dbModules/db');
const logger = require('../../logger');

module.exports = async (req, res, next) => {
  // Pobierz token z ciasteczka
  const token = req.cookies.token;

  // Sprawdź, czy token istniej
  if (!token) {
    return res.status(401).json({ 
      error: 'Brak autoryzacji',
      code: 'token_missing'
    });
  }

  try {
    // Weryfikacja tokena JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Pobranie użytkownika z bazy danych
    const user = await db.oneOrNone('SELECT * FROM user_data_department WHERE user_id = $1', [decoded.userId]);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Użytkownik nie istnieje',
        code: 'user_not_found'
      });
    }
    
    // Dodanie danych użytkownika do obiektu request
    req.user = user;
    
    // Kontynuuj do następnego middleware/handlera
    next();
    
  } catch (error) {
    logger.error(`Weryfikacja tokena nie powiodła się: ${error.message}`);
    
    // Różne komunikaty błędów w zależności od rodzaju błędu
    if (error.name === 'TokenExpiredError') {
      logger.warn('Token wygasł - timeout sesji');
      return res.status(401).json({ 
        error: 'Sesja wygasła',
        code: 'token_expired'
      });
    }
    return res.status(403).json({ 
      error: 'Nieprawidłowy token',
      code: 'invalid_token'
    });
  }
};