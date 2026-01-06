const { body, param } = require('express-validator');
const { noSQLInjection, strictNumeric, safeFreeText } = require('./sqlSanitizer');

const addReaderValidation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Nazwa czytnika jest wymagana!')
        .isLength({ min: 1, max: 100 }).withMessage('Nazwa czytnika musi mieć od 1 do 100 znaków!')
        .custom(safeFreeText)
        .custom(noSQLInjection),
    body('location')
        .trim()
        .notEmpty().withMessage('Lokalizacja czytnika jest wymagana!')
        .isLength({ min: 1, max: 255 }).withMessage('Lokalizacja czytnika musi mieć od 1 do 255 znaków!')
        .custom(safeFreeText)
        .custom(noSQLInjection)
];

const updateReaderValidation = [
    param('readerId')
        .trim()
        .notEmpty().withMessage('ID czytnika jest wymagane!')
        .isInt({ gt: 0 }).withMessage('ID czytnika musi być dodatnią liczbą całkowitą!')
        .custom(strictNumeric)
        .custom(noSQLInjection),
    body('name')
        .optional()
        .trim()
        .notEmpty().withMessage('Nazwa czytnika nie może być pusta!')
        .isLength({ min: 1, max: 100 }).withMessage('Nazwa czytnika musi mieć od 1 do 100 znaków!')
        .custom(safeFreeText)
        .custom(noSQLInjection),
    body('location')
        .optional()
        .trim()
        .notEmpty().withMessage('Lokalizacja czytnika nie może być pusta!')
        .isLength({ min: 1, max: 255 }).withMessage('Lokalizacja czytnika musi mieć od 1 do 255 znaków!')
        .custom(safeFreeText)
        .custom(noSQLInjection)
];

module.exports = {
    addReaderValidation,
    updateReaderValidation
};