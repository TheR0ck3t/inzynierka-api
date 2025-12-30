/**
 * Funkcje zabezpieczające przed SQL Injection
 * 
 * UWAGA: To są dodatkowe zabezpieczenia. Głównym mechanizmem obronnym
 * są parametryzowane zapytania SQL (prepared statements) używane w pg-promise.
 */

/**
 * Lista słów kluczowych SQL które mogą wskazywać na próbę injection
 */
const SQL_KEYWORDS = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
    'TRUNCATE', 'EXEC', 'EXECUTE', 'UNION', 'DECLARE', 'CAST', 'CONVERT',
    '--', '/*', '*/', 'xp_', 'sp_', 'SCRIPT', 'JAVASCRIPT', 'EVAL',
    'INFORMATION_SCHEMA', 'SYSOBJECTS', 'SYSCOLUMNS'
];

/**
 * Sprawdza czy tekst zawiera potencjalnie niebezpieczne wzorce SQL
 * @param {string} value - Wartość do sprawdzenia
 * @returns {boolean} - True jeśli wykryto niebezpieczne wzorce
 */
function containsSQLKeywords(value) {
    if (typeof value !== 'string') return false;
    
    const upperValue = value.toUpperCase();
    return SQL_KEYWORDS.some(keyword => upperValue.includes(keyword));
}

/**
 * Sprawdza czy tekst zawiera podejrzane znaki SQL
 * @param {string} value - Wartość do sprawdzenia
 * @returns {boolean} - True jeśli wykryto podejrzane znaki
 */
function containsSuspiciousChars(value) {
    if (typeof value !== 'string') return false;
    
    // Wykrywa: pojedyncze apostrofy, średniki poza kontekstem, komentarze SQL
    const suspiciousPatterns = [
        /;\s*(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER|TRUNCATE)/i,  // Średnik przed SQL keyword
        /'\s*(OR|AND)\s*'?\d*\s*=\s*'?\d/i,                        // '1'='1' lub 1=1
        /UNION\s+SELECT/i,                                         // UNION SELECT attack
        /--\s*$/,                                                  // SQL comment na końcu
        /\/\*.*\*\//,                                              // Blokowe komentarze
        /0x[0-9a-f]+/i,                                            // Hex values (mogą być używane w atakach)
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(value));
}

/**
 * Custom validator dla express-validator
 * Sprawdza czy wartość nie zawiera prób SQL injection
 */
const noSQLInjection = (value) => {
    if (!value) return true; // Puste wartości sprawdzane są przez inne validatory
    
    const stringValue = String(value);
    
    if (containsSQLKeywords(stringValue)) {
        throw new Error('Wykryto niedozwolone słowa kluczowe SQL w danych wejściowych');
    }
    
    if (containsSuspiciousChars(stringValue)) {
        throw new Error('Wykryto podejrzane wzorce w danych wejściowych');
    }
    
    return true;
};

/**
 * Sanityzuje nazwę tabeli/kolumny
 * Usuwa wszystko oprócz liter, cyfr i podkreślnika
 */
function sanitizeIdentifier(identifier) {
    if (typeof identifier !== 'string') return '';
    return identifier.replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Sprawdza czy string zawiera tylko bezpieczne znaki dla identyfikatorów SQL
 */
const isSafeIdentifier = (value) => {
    if (!value) return true;
    
    // Identyfikatory SQL powinny zawierać tylko litery, cyfry i podkreślenia
    // i nie powinny zaczynać się od cyfry
    const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    
    if (!identifierPattern.test(value)) {
        throw new Error('Nieprawidłowy format identyfikatora');
    }
    
    return true;
};

/**
 * Dodatkowa walidacja dla wartości liczbowych
 * Upewnia się że wartość jest rzeczywiście liczbą
 */
const strictNumeric = (value) => {
    if (value === undefined || value === null || value === '') return true;
    
    // Sprawdź czy to liczba i czy nie zawiera niebezpiecznych znaków
    if (isNaN(value)) {
        throw new Error('Wartość musi być liczbą');
    }
    
    // Sprawdź czy string reprezentujący liczbę nie zawiera dodatkowych znaków
    const stringValue = String(value).trim();
    if (!/^-?\d+(\.\d+)?$/.test(stringValue)) {
        throw new Error('Nieprawidłowy format liczby');
    }
    
    return true;
};

/**
 * Walidacja dla stringów które mogą zawierać spacje i znaki specjalne
 * ale powinny być bezpieczne dla SQL
 */
const safeFreeText = (value) => {
    if (!value) return true;
    
    const stringValue = String(value);
    
    // Dozwolone znaki: litery (w tym polskie), cyfry, spacje, podstawowa interpunkcja
    // Blokuje: średniki, apostrofy samotne (nie w kontekście), komentarze SQL
    const dangerousPatterns = [
        /;\s*(?:DROP|DELETE|UPDATE|INSERT|CREATE|ALTER|TRUNCATE|EXEC|SELECT|UNION)/i,
        /'\s*(?:OR|AND)\s*'/i,
        /--/,
        /\/\*/,
        /\*\//,
        /xp_/i,
        /sp_/i
    ];
    
    if (dangerousPatterns.some(pattern => pattern.test(stringValue))) {
        throw new Error('Wykryto niedozwolone znaki lub wzorce w tekście');
    }
    
    return true;
};

module.exports = {
    noSQLInjection,
    sanitizeIdentifier,
    isSafeIdentifier,
    strictNumeric,
    safeFreeText,
    containsSQLKeywords,
    containsSuspiciousChars
};
