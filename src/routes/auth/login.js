const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db');
const jwt = require('jsonwebtoken');
const { comparePasswords } = require('../../modules/authModules/userAuth');

// Endpoint do logowania
router.post('/', async(req, res) => {
    const { email, password, token2fa } = req.body;

    console.log('Received request to login with email:', email);

    // Walidacja emaila i hasła
    if (!email || !password) {
        console.log('Missing email or password');
        return res.status(400).json({ error: 'Missing email or password' });
    }

    try {
        // Sprawdzenie, czy użytkownik istnieje i jest aktywny
        const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
        if (!user) {
            console.log('User not found');
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!user.is_active) {
            console.log('User is not active');
            return res.status(401).json({ error: 'User is not active' });
        }

        console.log('User found:', user.email);

        // Porównanie hasła
        const isMatch = await comparePasswords(password, user.password);
        if (!isMatch) {
            console.log('Password mismatch');
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        console.log('Password matched');

        // Sprawdzenie, czy 2FA jest włączone
        if (user.two_factor_secret) {
            console.log('2FA is enabled');

            if (token2fa) {
                // Przekierowanie do trasy /verify
                return res.redirect(307, '/auth/2fa/verify');
            }

            // Jeśli 2FA nie jest podane, poproś o 2FA
            console.log('Prompting for 2FA');
            return res.status(200).json({
                requires2FA: true,
                userId: user.id,
            });
        }

        console.log('2FA is not enabled');

        // Jeśli 2FA nie jest wymagane, wygeneruj token JWT i kontynuuj
        const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Ustawienie ciasteczek dla tokena i userId
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 3600000 // 1 godzina
        });
        // res.cookie('userId', user.id.toString(), {
        //     httpOnly: false, // Ustaw na false dla dostępu z frontendu
        //     secure: process.env.NODE_ENV === 'production', // Ustaw na false dla lokalnego dev
        //     sameSite: 'lax',
        //     maxAge: 3600000 // 1 godzina
        // });

        console.log('Cookies set for user:', user.email);

        // Aktualizacja ostatniego logowania
        try {
            await db.oneOrNone('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE email = $1', [email]);
            console.log('Last login updated for user:', email);
        } catch (err) {
            console.log('Error updating last login:', err);
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