const { body, param } = require('express-validator');
const { noSQLInjection, strictNumeric, safeFreeText } = require('./sqlSanitizer');

const createAccountValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email jest wymagany!')
        .isEmail().withMessage('Nieprawidłowy format adresu email!')
        .normalizeEmail()        
        .custom(noSQLInjection),
    body('employee_id')
        .trim()
        .notEmpty().withMessage('ID pracownika jest wymagane!')
        .isInt({ gt: 0 }).withMessage('ID pracownika musi być dodatnią liczbą całkowitą!')
        .custom(strictNumeric)
        .custom(noSQLInjection)
    ];

const updateAccountValidation = [
    body('first_name')
        .optional()
        .trim()
        .notEmpty().withMessage('Imię nie może być puste!')
        .isLength({ min: 2, max: 50 }).withMessage('Imię musi mieć od 2 do 50 znaków!')
        .matches(/^[A-Za-zÀ-ÖØ-öø-ÿ '-]+$/).withMessage('Imię może zawierać tylko litery, spacje, apostrofy i myślniki!')
        .custom(noSQLInjection),
    body('last_name')
        .optional()
        .trim()
        .notEmpty().withMessage('Nazwisko nie może być puste!')
        .isLength({ min: 2, max: 50 }).withMessage('Nazwisko musi mieć od 2 do 50 znaków!')
        .matches(/^[A-Za-zÀ-ÖØ-öø-ÿ '-]+$/).withMessage('Nazwisko może zawierać tylko litery, spacje, apostrofy i myślniki!')
        .custom(noSQLInjection),
    body('email')
        .optional()
        .trim()
        .notEmpty().withMessage('Email nie może być pusty!')
        .isEmail().withMessage('Nieprawidłowy format adresu email!')
        .normalizeEmail()
        .custom(noSQLInjection),
    body('phone_number')
        .optional()
        .trim()
        .matches(/^(\+?48)?[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}$/).withMessage('Nieправидłowy format numeru telefonu (oczekiwano formatu +48 XXX XXX XXX lub XXX XXX XXX)')
        .custom(noSQLInjection),
    body('current_password')
        .optional()
        .trim()
        .notEmpty().withMessage('Obecne hasło nie może być puste!')
        .custom(safeFreeText)
        .custom(noSQLInjection),
    body('new_password')
        .optional()
        .trim()
        .notEmpty().withMessage('Nowe hasło nie może być puste!')
        .isLength({ min: 8 }).withMessage('Nowe hasło musi mieć minimum 8 znaków!')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).withMessage('Hasło musi zawierać małą literę, wielką literę, cyfrę i znak specjalny!')
        .custom(safeFreeText)
        .custom(noSQLInjection)
];

const deleteAccountValidation = [
    param('id')
        .trim()
        .notEmpty().withMessage('ID użytkownika jest wymagane!')
        .isInt({ gt: 0 }).withMessage('ID użytkownika musi być dodatnią liczbą całkowitą!')
        .custom(strictNumeric)
        .custom(noSQLInjection)
];

module.exports = {
    createAccountValidation,
    updateAccountValidation,
    deleteAccountValidation
};
