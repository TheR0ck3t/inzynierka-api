const { validationResult } = require('express-validator');
const logger = require('../../logger');

function validateRequest(req, res, next) {
    logger.info(`validateRequest middleware: Validating request for ${req.method} ${req.path} from IP: ${req.ip}`);
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const errorList = errors.array();
        
        logger.warn(`Walidacja nie powiodła się dla: ${req.method} ${req.path}`, {
            errors: errorList,
            body: req.body,
            params: req.params,
        });

        // Formatuj błędy jako pojedynczy komunikat (pierwszy błąd) + szczegółowa lista
        const firstError = errorList[0];
        const errorMessage = firstError.msg || 'Nieprawidłowe dane w żądaniu';

        return res.status(400).json({
            error: errorMessage,
            message: errorMessage,
            errors: errorList.map(err => ({
                field: err.param,
                message: err.msg,
                value: err.value
            }))
        });
    }
    next();
}

module.exports = validateRequest;