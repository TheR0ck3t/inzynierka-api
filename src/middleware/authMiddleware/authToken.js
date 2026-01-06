const jwt = require('jsonwebtoken');
const db = require('../../modules/dbModules/db');
const logger = require('../../logger');

const authTokenMiddleware = async (req, res, next, allowedDepartments = null) => {
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

    // Jeśli określono wymagane departamenty, sprawdź
    if (allowedDepartments) {
      const departments = Array.isArray(allowedDepartments) 
        ? allowedDepartments 
        : [allowedDepartments];
      
      if (!departments.includes(user.department_name)) {
        logger.warn(`Access denied for ${user.email} - required: ${departments.join(', ')}, has: ${user.department_name}`);
        return res.status(403).json({ 
          status: 'error',
          error: 'Brak uprawnień do tego zasobu',
          code: 'insufficient_permissions'
        });
      }
    }
    
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

// Eksport kompatybilny wstecz
// Użycie: authToken() lub authToken('IT') lub authToken('IT', 'HR') lub authToken(['IT', 'HR'])
const authToken = (...allowedDepartments) => {
  // Sprawdź czy to wywołanie bezpośrednie (stary sposób) czy z parametrem
  // Jeśli pierwszy argument wygląda jak req object, to stare użycie
  if (allowedDepartments.length > 0 && 
      allowedDepartments[0] && 
      typeof allowedDepartments[0] === 'object' && 
      (allowedDepartments[0].method || allowedDepartments[0].headers)) {
    // Stare użycie: authToken wywołane bezpośrednio przez Express
    const req = allowedDepartments[0];
    const res = allowedDepartments[1];
    const next = allowedDepartments[2];
    return authTokenMiddleware(req, res, next, null);
  }
  
  // Normalizacja: jeśli pierwszy argument to tablica, użyj jej, w przeciwnym razie użyj wszystkich argumentów
  let departments = null;
  if (allowedDepartments.length > 0) {
    if (Array.isArray(allowedDepartments[0])) {
      // authToken(['IT', 'HR'])
      departments = allowedDepartments[0];
    } else {
      // authToken('IT', 'HR') lub authToken('IT')
      departments = allowedDepartments;
    }
  }
  
  // Nowe użycie: authToken() lub authToken('IT') lub authToken('IT', 'HR')
  return (req, res, next) => authTokenMiddleware(req, res, next, departments);
};

module.exports = authToken;