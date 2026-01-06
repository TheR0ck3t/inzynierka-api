const {body, param} = require('express-validator');
const db = require('../modules/dbModules/db');
const { noSQLInjection, strictNumeric } = require('./sqlSanitizer');

const addEmployeeValidation = [
    body('first_name')
        .trim()
        .notEmpty().withMessage('Imię jest wymagane!')
        .isLength({ min: 2, max: 50 }).withMessage('Imię musi mieć od 2 do 50 znaków!')
        .matches(/^[A-Za-zÀ-ÖØ-öø-ÿ '-]+$/).withMessage('Imię może zawierać tylko litery, spacje, apostrofy i myślniki!')
        .custom(noSQLInjection),
    body('last_name')
        .trim()
        .notEmpty().withMessage('Nazwisko jest wymagane!')
        .isLength({ min: 2, max: 50 }).withMessage('Nazwisko musi mieć od 2 do 50 znaków!')
        .matches(/^[A-Za-zÀ-ÖØ-öø-ÿ '-]+$/).withMessage('Nazwisko może zawierać tylko litery, spacje, apostrofy i myślniki!')
        .custom(noSQLInjection),
    body('dob')
        .trim()
        .notEmpty().withMessage('Data urodzenia jest wymagana!')
        .isISO8601().withMessage('Data urodzenia musi być w formacie RRRR-MM-DD!')
        .custom(value => {
            const birthDate = new Date(value);
            const today = new Date();
            
            // Dokładne obliczenie wieku (uwzględnia miesiąc i dzień)
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            const dayDiff = today.getDate() - birthDate.getDate();
            
            // Jeśli jeszcze nie miał urodzin w tym roku, odejmij 1
            if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
                age--;
            }
            
            // Minimalne 15 lat (młodociani pracownicy mogą pracować od 15 roku życia)
            if (age < 15) {
                throw new Error('Pracownik musi mieć ukończone 15 lat');
            }
            if (age > 100) {
                throw new Error('Nieprawidłowa data urodzenia (wiek > 100 lat)');
            }
            
            return true;
        }),
    body('employment_date')
        .trim()
        .notEmpty().withMessage('Data zatrudnienia jest wymagana!')
        .isISO8601().withMessage('Data zatrudnienia musi być w formacie RRRR-MM-DD!')
        .custom((value, { req }) => {
            const employmentDate = new Date(value);
            const birthDate = new Date(req.body.dob);
            const today = new Date();
            
            // Sprawdź czy data zatrudnienia nie jest wcześniejsza niż data urodzenia
            if (employmentDate < birthDate) {
                throw new Error('Data zatrudnienia nie może być wcześniejsza niż data urodzenia');
            }
            
            // Pozwól na datę zatrudnienia do 3 miesięcy w przyszłość (okres wypowiedzenia/rekrutacji)
            const maxFutureDate = new Date();
            maxFutureDate.setMonth(maxFutureDate.getMonth() + 3);
            
            if (employmentDate > maxFutureDate) {
                throw new Error('Data zatrudnienia może być maksymalnie 3 miesiące w przyszłości');
            }
            
            return true;
        }),
    body('employment_type_id')
        .trim()
        .notEmpty().withMessage('Typ zatrudnienia jest wymagany!')
        .isInt({ gt: 0 }).withMessage('Typ zatrudnienia musi być dodatnią liczbą całkowitą!')
        .custom(strictNumeric)
        .custom(async (value) => {
            const employmentType = await db.oneOrNone(
                'SELECT * FROM employment_types WHERE employment_type_id = $1 AND employment_is_active = true',
                [value]
            );
            if (!employmentType) {
                throw new Error('Wybrana forma zatrudnienia nie istnieje lub jest nieaktywna');
            }
            return true;
        })
        .custom(noSQLInjection)
];

const updateEmployeeValidation = [
    param('id')
        .trim()
        .notEmpty().withMessage('ID pracownika jest wymagane!')
        .isInt({ gt: 0 }).withMessage('ID pracownika musi być dodatnią liczbą całkowitą!')
        .custom(strictNumeric)
        .custom(noSQLInjection),
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
    body('employment_type_id')
        .optional()
        .trim()
        .notEmpty().withMessage('Typ zatrudnienia nie może być pusty!')
        .isInt({ gt: 0 }).withMessage('Typ zatrudnienia musi być dodatnią liczbą całkowitą!')
        .custom(strictNumeric)
        .custom(async (value) => {
            const employmentType = await db.oneOrNone(
                'SELECT * FROM employment_types WHERE employment_type_id = $1 AND employment_is_active = true',
                [value]
            );
            if (!employmentType) {
                throw new Error('Wybrana forma zatrudnienia nie istnieje lub jest nieaktywna');
            }
            return true;
        })
        .custom(noSQLInjection),
];

const deleteEmployeeValidation = [
    param('id')
        .trim()
        .notEmpty().withMessage('ID pracownika jest wymagane!')
        .isInt({ gt: 0 }).withMessage('ID pracownika musi być dodatnią liczbą całkowitą!')
        .custom(strictNumeric)
        .custom(noSQLInjection)
];

const getEmployeeValidation = [
    param('id')
        .trim()
        .notEmpty().withMessage('ID pracownika jest wymagane!')
        .isInt({ gt: 0 }).withMessage('ID pracownika musi być dodatnią liczbą całkowitą!')
        .custom(strictNumeric)
        .custom(noSQLInjection)
];

module.exports = {
    addEmployeeValidation,
    updateEmployeeValidation,
    deleteEmployeeValidation,
    getEmployeeValidation
};