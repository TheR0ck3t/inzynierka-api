const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db'); // Import bazy danych
const authToken = require('../../middleware/authMiddleware/authToken')
const userAuth = require('../../modules/authModules/userAuth'); // Import modułu autoryzacji użytkownika
const logger = require('../../logger');
const { createAccountValidation, updateAccountValidation, deleteAccountValidation } = require('../../validators/validators');
const validateRequest = require('../../middleware/validationMiddleware/validateRequest');
const mailService = require('../../services/mailService/mailService'); // Import modułu mailowego
const jwt = require('jsonwebtoken');

router.get('/', authToken('IT'), async (req, res) => {
    try {
        const data = await db.any('SELECT * FROM user_data_department');
        res.json({
            status: 'success',
            message: 'Fetched all users successfully',
            data: data
        });
    } catch (error) {
        logger.error(`Błąd podczas pobierania listy użytkowników: ${error.message || error}`);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch users',
            error: error.message || error
        });
    }
});

router.post('/add', authToken('IT'), createAccountValidation, validateRequest, async (req, res) => {
    const {email, employee_id } = req.body;
    const generatedPassword = generatePassword();
    try {
        const hashedPassword = await userAuth.hashPassword(generatedPassword);

        const userExists = await db.oneOrNone('SELECT user_id FROM user_data WHERE email = $1', [email]);
        if (userExists) {
            return res.status(400).json({
                error: 'userAlreadyExists',
                message: 'Użytkownik z tym adresem e-mail już istnieje!'
            });
        }
        const employeeUser = await db.oneOrNone('SELECT employee_id FROM user_data WHERE employee_id = $1', [employee_id]);
        if (employeeUser) {
            return res.status(400).json({
                error: 'employeeHasAccount',
                message: 'Pracownik posiada już konto powiązane z tym ID!'
            });
        }

        // Użyj transakcji - jeśli cokolwiek się nie uda, rollback
        const newUser = await db.transaction(async (t) => {
            const employee = await t.oneOrNone('SELECT employee_id, first_name, last_name FROM employees WHERE employee_id = $1', [employee_id]);
            if (!employee) {
                throw new Error('Employee not found');
            }
            const { first_name, last_name } = employee;
            // 1. Stwórz użytkownika
            const user = await t.one(
                'INSERT INTO users (employee_id, email, password) VALUES ($1, $2, $3) RETURNING user_id, created_at, is_active',
                [employee_id, email, hashedPassword]
            );  
            // 2. Wyślij e-mail z danymi logowania
            try {
                const verification_token = jwt.sign(
                    { user_id: user.user_id, email: email },
                    process.env.EMAIL_VERIFICATION_SECRET,
                    { expiresIn: '2d' }
                );
                await mailService.sendWelcomeEmail(email, first_name, last_name, generatedPassword, verification_token);
                logger.info(`E-mail z danymi logowania wysłany do: ${email}`);
            } catch (mailError) {
                logger.error(`Błąd wysyłania e-maila do ${email}: ${mailError.message || mailError}`);
                throw new Error('Failed to send account creation email');
            }
            // 3. Zwróć nowo utworzonego użytkownika
            return user;
        });
        
        return res.json({
            status: 'success',
            message: 'Account created successfully!',
            data: newUser
        });

    } catch (error) {
        logger.error(`Błąd tworzenia konta: ${error.message || error}`);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to create account.',
            error: error.message || error
        });
    }
});

router.delete('/delete/:id', authToken('IT'), deleteAccountValidation, validateRequest, async (req, res) => {
    const userId = req.params.id;
    
    try {
        const result = await db.result('DELETE FROM users WHERE user_id = $1', [userId]);
        
        if (result.rowCount > 0) {
            logger.info(`Użytkownik ${userId} został usunięty`);
            res.json({
                status: 'success',
                message: 'User deleted successfully',
                deletedCount: result.rowCount
            });
        } else {
            res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }
    } catch (error) {
        logger.error(`Błąd usuwania użytkownika: ${error.message || error}`);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete user',
            error: error.message || error
        });
    }
});

router.put('/update/', authToken('IT'), updateAccountValidation, validateRequest, async (req, res) => {
    const userId = req.user.user_id;
    const updates = req.body;
    
    try {
        // Obsługa zmiany hasła - w transakcji z logowaniem
        if (updates.current_password && updates.new_password) {
            await db.transaction(async (t) => {
                // Pobierz aktualny hash hasła z bazy
                const user = await t.oneOrNone('SELECT password FROM users WHERE user_id = $1', [userId]);
                if (!user) {
                    throw new Error('User not found');
                }
                // Porównaj stare hasło
                const isMatch = await userAuth.comparePasswords(updates.current_password, user.password);
                if (!isMatch) {
                    throw new Error('Nieprawidłowe obecne hasło');
                }
                // Zhashuj nowe hasło
                const hashedPassword = await userAuth.hashPassword(updates.new_password);
                // Zaktualizuj hasło w bazie
                await t.none('UPDATE users SET password = $1 WHERE user_id = $2', [hashedPassword, userId]);
                
                // Loguj zmianę hasła
                logger.info(`Użytkownik ${userId} zmienił hasło`);
            });
        }

        // Aktualizacja innych pól (bez haseł)
        const allowedFields = ['first_name', 'last_name', 'email', 'phone_number'];
        const fields = Object.keys(updates).filter(field => allowedFields.includes(field));
        
        if (fields.length > 0) {
            const setStatements = fields.map((field, index) => `${field} = $${index + 1}`);
            const query = `UPDATE users SET ${setStatements.join(', ')} WHERE user_id = $${fields.length + 1} RETURNING *`;
            const values = [...fields.map(field => updates[field]), userId];
            const updatedUser = await db.one(query, values);
            return res.json({
                status: 'success',
                message: 'User updated successfully',
                data: updatedUser
            });
        }

        // Jeśli tylko hasło było zmieniane
        if (updates.current_password && updates.new_password && fields.length === 0) {
            return res.json({
                status: 'success',
                message: 'Password updated successfully',
            });
        }

        // Jeśli nie było żadnych pól do aktualizacji
        if (!updates.current_password && !updates.new_password && fields.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No valid fields to update'
            });
        }
        
    } catch (error) {
        logger.error(`Error updating user: ${error.message || error}`);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update user',
            error: error.message || error
        });
    }
});

 function generatePassword() {
    var length = 12,
        charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+[]{}|;:,.<>?~",
        generatedPassword = "";
    for (var i = 0, n = charset.length; i < length; ++i) {
        generatedPassword += charset.charAt(Math.floor(Math.random() * n));
    }
    return generatedPassword;
}

module.exports = {
   path: '/accounts',
    router,
    routeName: 'accounts' 
}