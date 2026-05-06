const { body, param } = require('express-validator');
const { noSQLInjection, strictNumeric, safeFreeText } = require('./sqlSanitizer');

const addReaderValidation = [
    body('device_id')
        .trim()
        .notEmpty().withMessage('ID urządzenia jest wymagane!')
        .isLength({ min: 1, max: 100 }).withMessage('ID urządzenia musi mieć od 1 do 100 znaków!')
        .matches(/^[A-Za-z0-9_-]+$/).withMessage('ID urządzenia może zawierać tylko litery, cyfry, myślniki i podkreślenia!')
        .custom(noSQLInjection),
    body('reader_name')
        .trim()
        .notEmpty().withMessage('Nazwa czytnika jest wymagana!')
        .isLength({ min: 1, max: 100 }).withMessage('Nazwa czytnika musi mieć od 1 do 100 znaków!')
        .custom(safeFreeText)
        .custom(noSQLInjection)
];

const updateReaderValidation = [
    param('id')
        .trim()
        .notEmpty().withMessage('ID urządzenia jest wymagane!')
        .isLength({ min: 1, max: 100 }).withMessage('ID urządzenia musi mieć od 1 do 100 znaków!')
        .matches(/^[A-Za-z0-9_-]+$/).withMessage('ID urządzenia może zawierać tylko litery, cyfry, myślniki i podkreślenia!')
        .custom(noSQLInjection),
    body('reader_name')
        .optional()
        .trim()
        .notEmpty().withMessage('Nazwa czytnika nie może być pusta!')
        .isLength({ min: 1, max: 100 }).withMessage('Nazwa czytnika musi mieć od 1 do 100 znaków!')
        .custom(safeFreeText)
        .custom(noSQLInjection)
];

const deleteReaderValidation = [
    param('id')
        .trim()
        .notEmpty().withMessage('ID urządzenia jest wymagane!')
        .isLength({ min: 1, max: 100 }).withMessage('ID urządzenia musi mieć od 1 do 100 znaków!')
        .matches(/^[A-Za-z0-9_-]+$/).withMessage('ID urządzenia może zawierać tylko litery, cyfry, myślniki i podkreślenia!')
        .custom(noSQLInjection)
];

module.exports = {
    addReaderValidation,
    updateReaderValidation,
    deleteReaderValidation
};