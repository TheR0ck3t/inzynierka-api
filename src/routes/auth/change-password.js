const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db');
const authToken = require('../../middleware/authMiddleware/authToken');
const { comparePasswords, hashPassword } = require('../../modules/authModules/userAuth');
const { body } = require('express-validator');
const validateRequest = require('../../middleware/validationMiddleware/validateRequest');
const logger = require('../../logger');

// Walidacja dla zmiany hasła
const changePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Obecne hasło jest wymagane'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('Nowe hasło musi mieć co najmniej 8 znaków')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/)
        .withMessage('Hasło musi zawierać: wielką literę, małą literę, cyfrę i znak specjalny'),
    body('confirmPassword')
        .custom((value, { req }) => value === req.body.newPassword)
        .withMessage('Hasła nie są identyczne')
];

// Endpoint do zmiany hasła
router.post('/', authToken(), changePasswordValidation, validateRequest, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user_id = req.user.user_id;

    try {
        // Pobierz użytkownika
        const user = await db.oneOrNone('SELECT * FROM users WHERE user_id = $1', [user_id]);
        
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'Użytkownik nie został znaleziony'
            });
        }

        // Sprawdź czy obecne hasło jest poprawne
        const isMatch = await comparePasswords(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({
                status: 'error',
                message: 'Obecne hasło jest nieprawidłowe'
            });
        }

        // Sprawdź czy nowe hasło nie jest takie samo jak stare
        const isSameAsOld = await comparePasswords(newPassword, user.password);
        if (isSameAsOld) {
            return res.status(400).json({
                status: 'error',
                message: 'Nowe hasło nie może być takie samo jak obecne'
            });
        }

        // Hashuj nowe hasło
        const hashedPassword = await hashPassword(newPassword);

        // Zaktualizuj hasło w bazie danych
        await db.none(
            'UPDATE users SET password = $1, last_login = CURRENT_TIMESTAMP WHERE user_id = $2',
            [hashedPassword, user_id]
        );

        logger.info(`Użytkownik ${user.email} (ID: ${user_id}) zmienił hasło`);

        return res.status(200).json({
            status: 'success',
            message: 'Hasło zostało pomyślnie zmienione'
        });

    } catch (error) {
        logger.error(`Błąd podczas zmiany hasła dla użytkownika ID ${user_id}: ${error.message || error}`);
        return res.status(500).json({
            status: 'error',
            message: 'Nie udało się zmienić hasła',
            error: error.message || error
        });
    }
});

module.exports = {
    path: '/auth/change-password',
    router,
    routeName: 'change-password'
};
