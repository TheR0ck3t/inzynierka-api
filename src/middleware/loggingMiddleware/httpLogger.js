const logger = require('../../logger');

/**
 * Middleware do logowania wszystkich żądań HTTP
 * Przechwytuje request/response i loguje metadane
 */
const httpLogger = (req, res, next) => {
    const start = Date.now();
    
    // Interceptuj metodę res.json() aby przechwycić status i czas odpowiedzi
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    
    // Funkcja logująca - wywoływana po wysłaniu response
    const logResponse = (body) => {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;
        const userInfo = req.user ? `Użytkownik: ${req.user.email} (ID: ${req.user.user_id})` : 'Anonymous';
        
        // Określ poziom logowania na podstawie status code
        const logLevel = statusCode >= 500 ? 'error' 
                       : statusCode >= 400 ? 'warn' 
                       : 'info';
        
        // Opcjonalne: Filtruj wrażliwe dane z body (hasła, tokeny)
        const sanitizedBody = body && typeof body === 'object' 
            ? { ...body, password: body.password ? '***' : undefined }
            : body;
        
        // Loguj z odpowiednim poziomem
        logger[logLevel](`HTTP ${req.method} ${req.originalUrl}\n- Status: ${statusCode}\n- Duration: ${duration}ms\n- IP: ${req.ip}\n- ${userInfo}`, {
            method: req.method,
            url: req.originalUrl,
            statusCode,
            duration,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            userId: req.user?.user_id,
            // responseBody: sanitizedBody // Odkomentuj jeśli chcesz logować body (może być duże)
        });
    };
    
    // Nadpisz res.json()
    res.json = (body) => {
        logResponse(body);
        return originalJson(body);
    };
    
    // Nadpisz res.send() dla kompatybilności
    res.send = (body) => {
        logResponse(body);
        return originalSend(body);
    };
    
    // Obsługa błędów - loguj nawet jeśli response nie został wysłany
    res.on('finish', () => {
        if (!res.headersSent) {
            logger.warn(`Odpowiedź zakończona bez wysłania nagłówków dla ${req.method} ${req.originalUrl}`);
        }
    });
    
    // Loguj początek requestu (opcjonalne)
    logger.debug(`→ Przychodzące ${req.method} ${req.originalUrl} z IP: ${req.ip}`);
    
    next();
};

module.exports = httpLogger;