const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db');
const jwt = require('jsonwebtoken');
const { comparePasswords } = require('../../modules/authModules/userAuth');

// Endpoint do logowania
router.post('/', async(req, res) => {
    const { email, password, token2fa } = req.body;

    // Walidacja emaila i hasła
    if (!email || !password) {
        return res.status(400).json({ error: 'Missing email or password' });
    }

    try {
        // Sprawdzenie, czy użytkownik istnieje i jest aktywny
        const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!user.is_active) {
            return res.status(401).json({ error: 'User is not active' });
        }

        // Porównanie hasła
        const isMatch = await comparePasswords(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Sprawdzenie, czy 2FA jest włączone
        if( user.two_factor_secret) {
            // Jeśli 2FA jest włączone, sprawdź token 2FA
            if (!token2fa) {
                return res.status(200).json({ 
                    requires2FA: true, 
                    error: '2FA token is required' 
                });
            }
            const { verify2FA } = require('../../modules/2faModules/2fa');
            const is2FAValid = await verify2FA(user.two_factor_secret, token2fa);
            if (!is2FAValid) {
                return res.status(200).json({ 
                    requires2FA: true, 
                    error: 'Invalid 2FA token' 
                });
            }
            // Jeśli token 2FA jest poprawny, kontynuuj logowanie
        } 

        // Jeśli 2FA nie jest wymagane, wygeneruj token JWT i kontynuuj
        const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { 
            expiresIn: process.env.JWT_EXPIRES_IN || '1h' 
        });

        // Ustawienie ciasteczek dla tokena 
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: process.env.SESSION_TIMEOUT // 1 godzina
        });

        // Aktualizacja ostatniego logowania
        try {
            await db.oneOrNone('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE email = $1', [email]);
        } catch (err) {
            // Error updating last login - log silently
        }
        return res.status(200).json({ message: 'Logged in successfully', user: {
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
        } });
    } catch (error) {
        console.error('Error during login process:', error);
        return res.status(500).json({ error: 'Failed to log in' });
    }
});

module.exports = {
    path: '/auth/login',
    router,
    routeName: 'login'
};