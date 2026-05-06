const rateLimit = require('express-rate-limit');
const logger = require('../../logger');

/**
 * Rate limiter dla endpointu logowania
 * max 5 prób na email w ciągu 15 minut
 */
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minut
    max: 5, // max 5 prób na IP w oknie czasowym
    standardHeaders: true, // Zwraca informacje o rate limit w `RateLimit-*` headerach
    legacyHeaders: false, // Wyłącza `X-RateLimit-*` headery
    keyGenerator: (req, res) => {
        // Używaj email z body zamiast IP, aby być bardziej precyzyjnym
        return req.body?.email || req.ip;
    },
    skip: (req, res) => {
        // Nie limituj jeśli email nie jest dostępny
        return !req.body?.email;
    },
    handler: (req, res) => {
        logger.warn(`Zbyt wiele prób logowania dla email: ${req.body?.email || 'unknown'} z IP: ${req.ip}`);
        res.status(429).json({
            error: 'Zbyt wiele nieudanych prób logowania',
            message: 'Zostałeś tymczasowo zablokowany. Spróbuj ponownie za 15 minut',
            retryAfter: 15 * 60
        });
    }
});

module.exports = loginRateLimiter;
