const { body, param } = require('express-validator');
const { noSQLInjection, strictNumeric, safeFreeText } = require('./sqlSanitizer');

const addTagValidation = [
    body('tag')
        .trim()
        .notEmpty().withMessage('Tag ID jest wymagany!')
        .isLength({ min: 1, max: 100 }).withMessage('Tag ID musi mieć od 1 do 100 znaków!')
        .matches(/^[A-Za-z0-9_-]+$/).withMessage('Tag ID może zawierać tylko litery, cyfry, myślniki i podkreślenia!')
        .custom(noSQLInjection),
    body('secret')
        .trim()
        .notEmpty().withMessage('Secret jest wymagany!')
        .isLength({ min: 8, max: 255 }).withMessage('Secret musi mieć od 8 do 255 znaków!')
        .custom(safeFreeText)
];

const deleteTagValidation = [
    param('tagId')
        .trim()
        .notEmpty().withMessage('Tag ID jest wymagany!')
        .isLength({ min: 1, max: 100 }).withMessage('Tag ID musi mieć od 1 do 100 znaków!')
        .custom(noSQLInjection)
];

const enrollRfidValidation = [
    body('reader')
        .optional()
        .trim()
        .notEmpty().withMessage('Reader nie może być pusty!')
        .isLength({ min: 1, max: 50 }).withMessage('Reader musi mieć od 1 do 50 znaków!')
        .custom(noSQLInjection),
    body('employeeId')
        .trim()
        .notEmpty().withMessage('Employee ID jest wymagany!')
        .isInt({ gt: 0 }).withMessage('Employee ID musi być dodatnią liczbą całkowitą!')
        .custom(strictNumeric)
];

const updateSecretValidation = [
    param('tagId')
        .trim()
        .notEmpty().withMessage('Tag ID jest wymagany!')
        .isLength({ min: 1, max: 100 }).withMessage('Tag ID musi mieć od 1 do 100 znaków!')
        .custom(noSQLInjection),
    body('newSecret')
        .trim()
        .notEmpty().withMessage('New secret jest wymagany!')
        .isLength({ min: 8, max: 255 }).withMessage('New secret musi mieć od 8 do 255 znaków!')
        .custom(safeFreeText)
];

const saveRfidValidation = [
    body('reader')
        .trim()
        .notEmpty().withMessage('Reader jest wymagany!')
        .isLength({ min: 1, max: 50 }).withMessage('Reader musi mieć od 1 do 50 znaków!')
        .custom(noSQLInjection),
    body('tagId')
        .trim()
        .notEmpty().withMessage('Tag ID jest wymagany!')
        .isLength({ min: 1, max: 100 }).withMessage('Tag ID musi mieć od 1 do 100 znaków!')
        .custom(noSQLInjection),
    body('sessionId')
        .optional()
        .trim()
        .custom(noSQLInjection),
    body('tagSecret')
        .optional()
        .trim()
        .isLength({ min: 8, max: 255 }).withMessage('Tag secret musi mieć od 8 do 255 znaków!')
        .custom(safeFreeText)
];

const checkAccessValidation = [
    param('uid')
        .trim()
        .notEmpty().withMessage('UID jest wymagany!')
        .isLength({ min: 1, max: 100 }).withMessage('UID musi mieć od 1 do 100 znaków!')
        .custom(noSQLInjection)
];

module.exports = {
    addTagValidation,
    deleteTagValidation,
    enrollRfidValidation,
    updateSecretValidation,
    saveRfidValidation,
    checkAccessValidation
};
