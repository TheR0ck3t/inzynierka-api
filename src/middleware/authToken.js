const jwt = require('jsonwebtoken');
const db = require('../modules/dbModules/db');
const logger = require('../logger');

module.exports = async (req, res, next) => {
  logger.info(`AuthToken middleware: Verifying token for user ${req.user ? req.user.user_id : 'unknown user'} for request from IP: ${req.ip} to ${req.originalUrl} with method ${req.method} `);
  // Pobierz token z ciasteczka
  const token = req.cookies.token;

  // Sprawdź, czy token istnieje
  if (!token) {
    logger.warn(`No token provided by ${req.user ? req.user.user_id : 'unknown user'} request from IP: ${req.ip}`);
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
    logger.error(`AuthToken middleware: Token verification for ${req.user ? req.user.user_id : 'unknown user'} failed for request from IP: ${req.ip} - ${error.message}`);
    
    // Różne komunikaty błędów w zależności od rodzaju błędu
    if (error.name === 'TokenExpiredError') {
      logger.warn(`AuthToken middleware: Token expired for ${req.user ? req.user.user_id : 'unknown user'} request from IP: ${req.ip}`);
      return res.status(401).json({ 
        error: 'Sesja wygasła',
        code: 'token_expired'
      });
    }
    logger.warn(`AuthToken middleware: Invalid token for ${req.user ? req.user.user_id : 'unknown user'} request from IP: ${req.ip}`);
    return res.status(403).json({ 
      error: 'Nieprawidłowy token',
      code: 'invalid_token'
    });
  }
};