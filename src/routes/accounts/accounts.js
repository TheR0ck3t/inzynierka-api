const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db'); // Import bazy danych
const authToken = require('../../middleware/authToken')
const userAuth = require('../../modules/authModules/userAuth'); // Import modułu autoryzacji użytkownika



router.get('/', authToken, async (req, res) => {
    const userId = req.user.id
    const query = 'SELECT * FROM users WHERE ID != $1';
    db.any(query, [userId])
        .then(data => {
            res.json({
                status: 'success',
                message: 'Fetched all users successfully',
                data: data
            });
        })
        .catch(error => {
            console.error("Error fetching data:", error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch users',
                error: error.message || error
            });
        });
});

router.post('/create', authToken, async (req, res) => {
    const { firstName, lastName, email } = req.body;
    const generatedPassword = generatePassword();
    console.log('Generated password: ',generatedPassword);

    const hashedPassword = await userAuth.hashPassword(generatedPassword);

    const userExists = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists) {
        return res.status(400).json({
            error: 'userAlreadyExists',
            message: 'Użytkownik z tym adresem e-mail już istnieje!'
        });
    }

   
    // Używamy tekstu zapytania z bezpośrednimi parametrami
    const query =  'INSERT INTO users (first_name, last_name, email, password) VALUES ($1, $2, $3,$4) RETURNING *'
    const values =  [firstName, lastName, email, hashedPassword]; ;
    try {
        const data = await db.one(query,values);
        res.json({
            status: 'success',
            message: 'Account created successfully!',
            data: data
        });
    } catch (error) {
        console.error("Error inserting data:", error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create account.',
            error: error.message || error
        });
    }
});

router.delete('/delete/:id', authToken, async (req, res) => {
    const userId = req.params.id;
    
    db.result('DELETE FROM users WHERE id = $1', [userId])
        .then(result => {
            if (result.rowCount > 0) {
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
        })
        .catch(error => {
            console.error("Error deleting user:", error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to delete user',
                error: error.message || error
            });
        });
});

router.put('/update/', authToken, async (req, res) => {
    const userId = req.user.id;
    console.log('User ID:', userId);
    const updates = req.body;
    console.log('Updates received:', updates);
    try {
        // Obsługa zmiany hasła
        if (updates.current_password && updates.new_password) {
            // Pobierz aktualny hash hasła z bazy
            const user = await db.oneOrNone('SELECT password FROM users WHERE id = $1', [userId]);
            if (!user) {
                return res.status(404).json({ status: 'error', message: 'User not found' });
            }
            // Porównaj stare hasło
            const isMatch = await userAuth.comparePasswords(updates.current_password, user.password);
            if (!isMatch) {
                return res.status(400).json({ status: 'error', message: 'Nieprawidłowe obecne hasło' });
            }
            // Zhashuj nowe hasło
            const hashedPassword = await userAuth.hashPassword(updates.new_password);
            // Zaktualizuj hasło w bazie
            await db.none('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
        }

        // Aktualizacja innych pól (bez haseł)
        const allowedFields = ['first_name', 'last_name', 'email', 'phone_number'];
        const fields = Object.keys(updates).filter(field => allowedFields.includes(field));
        console.log('Fields to update:', fields);
        if (fields.length > 0) {
            const setStatements = fields.map((field, index) => `${field} = $${index + 1}`);
            const query = `UPDATE users SET ${setStatements.join(', ')} WHERE id = $${fields.length + 1} RETURNING *`;
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
        console.error("Error updating user:", error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update user',
            error: error.message || error
        });
    }
});

 function generatePassword() {
    var length = 12,
        charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+[]{}|;:,.<>?`~",
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