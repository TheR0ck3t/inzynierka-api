const {body } = require('express-validator');

const loginValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email jest wymagany!')
        .isEmail().withMessage('Nieprawidłowy format email!')
        .normalizeEmail(),
    body('password')
        .trim()
        .notEmpty().withMessage('Hasło jest wymagane!'),
    body('token2fa')
        .optional()
        .isLength({ min: 6, max: 6 }).withMessage('Token 2FA musi mieć dokładnie 6 znaków!')
        .isNumeric().withMessage('Token 2FA musi składać się tylko z cyfr!'),
];

const verify2FAValidation = [
    body('token2fa')
        .trim()
        .notEmpty().withMessage('Token 2FA jest wymagany!')
        .isLength({ min: 6, max: 6 }).withMessage('Token 2FA musi mieć dokładnie 6 znaków!')
        .isNumeric().withMessage('Token 2FA musi składać się tylko z cyfr!'),
];
const changePasswordValidation = [
    body('currentPassword')
        .trim()
        .notEmpty().withMessage('Stare hasło jest wymagane!'),
    body('newPassword')
        .trim()
        .notEmpty().withMessage('Nowe hasło jest wymagane!')
        .isLength({ min: 8 }).withMessage('Nowe hasło musi mieć co najmniej 8 znaków!')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Nowe hasło musi zawierać co najmniej jedną wielką literę, jedną małą literę, jedną cyfrę i jeden znak specjalny!'),
];

const enable2FAValidation = [
    // Nie wymaga parametrów body, używa userId z authToken
];

const disable2FAValidation = [
    // Nie wymaga parametrów body, używa userId z authToken
];

module.exports = {
    loginValidation,
    verify2FAValidation,
    changePasswordValidation,
    enable2FAValidation,
    disable2FAValidation
};