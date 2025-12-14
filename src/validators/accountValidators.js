const { body, param } = require('express-validator');

const createAccountValidation = [
    body('firstName')
        .trim()
        .notEmpty().withMessage('Imię jest wymagane!')
        .isLength({ min: 2, max: 50 }).withMessage('Imię musi mieć od 2 do 50 znaków!')
        .matches(/^[A-Za-zÀ-ÖØ-öø-ÿ '-]+$/).withMessage('Imię może zawierać tylko litery, spacje, apostrofy i myślniki!'),
    body('lastName')
        .trim()
        .notEmpty().withMessage('Nazwisko jest wymagane!')
        .isLength({ min: 2, max: 50 }).withMessage('Nazwisko musi mieć od 2 do 50 znaków!')
        .matches(/^[A-Za-zÀ-ÖØ-öø-ÿ '-]+$/).withMessage('Nazwisko może zawierać tylko litery, spacje, apostrofy i myślniki!'),
    body('email')
        .trim()
        .notEmpty().withMessage('Email jest wymagany!')
        .isEmail().withMessage('Nieprawidłowy format adresu email!')
        .normalizeEmail()
];

const updateAccountValidation = [
    body('first_name')
        .optional()
        .trim()
        .notEmpty().withMessage('Imię nie może być puste!')
        .isLength({ min: 2, max: 50 }).withMessage('Imię musi mieć od 2 do 50 znaków!')
        .matches(/^[A-Za-zÀ-ÖØ-öø-ÿ '-]+$/).withMessage('Imię może zawierać tylko litery, spacje, apostrofy i myślniki!'),
    body('last_name')
        .optional()
        .trim()
        .notEmpty().withMessage('Nazwisko nie może być puste!')
        .isLength({ min: 2, max: 50 }).withMessage('Nazwisko musi mieć od 2 do 50 znaków!')
        .matches(/^[A-Za-zÀ-ÖØ-öø-ÿ '-]+$/).withMessage('Nazwisko może zawierać tylko litery, spacje, apostrofy i myślniki!'),
    body('email')
        .optional()
        .trim()
        .notEmpty().withMessage('Email nie może być pusty!')
        .isEmail().withMessage('Nieprawidłowy format adresu email!')
        .normalizeEmail(),
    body('phone_number')
        .optional()
        .trim()
        .matches(/^(\+?48)?[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}$/).withMessage('Nieprawidłowy format numeru telefonu (oczekiwano formatu +48 XXX XXX XXX lub XXX XXX XXX)'),
    body('current_password')
        .optional()
        .trim()
        .notEmpty().withMessage('Obecne hasło nie może być puste!'),
    body('new_password')
        .optional()
        .trim()
        .notEmpty().withMessage('Nowe hasło nie może być puste!')
        .isLength({ min: 8 }).withMessage('Nowe hasło musi mieć minimum 8 znaków!')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).withMessage('Hasło musi zawierać małą literę, wielką literę, cyfrę i znak specjalny!')
];

const deleteAccountValidation = [
    param('id')
        .trim()
        .notEmpty().withMessage('ID użytkownika jest wymagane!')
        .isInt({ gt: 0 }).withMessage('ID użytkownika musi być dodatnią liczbą całkowitą!')
];

module.exports = {
    createAccountValidation,
    updateAccountValidation,
    deleteAccountValidation
};
