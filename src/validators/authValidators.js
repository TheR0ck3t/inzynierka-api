const {body } = require('express-validator');
const { noSQLInjection, safeFreeText } = require('./sqlSanitizer');

const loginValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email jest wymagany!')
        .isEmail().withMessage('Nieprawidłowy format email!')
        .normalizeEmail()
        .custom(noSQLInjection),
    body('password')
        .trim()
        .notEmpty().withMessage('Hasło jest wymagane!')
        .custom(safeFreeText)
        .custom(noSQLInjection),
    body('token2fa')
        .optional()
        .isLength({ min: 6, max: 6 }).withMessage('Token 2FA musi mieć dokładnie 6 znaków!')
        .isNumeric().withMessage('Token 2FA musi składać się tylko z cyfr!')
        .custom(noSQLInjection),
];

const verify2FAValidation = [
    body('token2fa')
        .trim()
        .notEmpty().withMessage('Token 2FA jest wymagany!')
        .isLength({ min: 6, max: 6 }).withMessage('Token 2FA musi mieć dokładnie 6 znaków!')
        .isNumeric().withMessage('Token 2FA musi składać się tylko z cyfr!')
        .custom(noSQLInjection),
];
const changePasswordValidation = [
    body('currentPassword')
        .trim()
        .notEmpty().withMessage('Stare hasło jest wymagane!')
        .custom(safeFreeText)
        .custom(noSQLInjection),
    body('newPassword')
        .trim()
        .notEmpty().withMessage('Nowe hasło jest wymagane!')
        .isLength({ min: 8 }).withMessage('Nowe hasło musi mieć co najmniej 8 znaków!')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Nowe hasło musi zawierać co najmniej jedną wielką literę, jedną małą literę, jedną cyfrę i jeden znak specjalny!')
        .custom(safeFreeText)
        .custom(noSQLInjection)
];



module.exports = {
    loginValidation,
    verify2FAValidation,
    changePasswordValidation
};