const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db');
const jwt = require('jsonwebtoken');
const { comparePasswords } = require('../../modules/authModules/userAuth');
const { loginValidation } = require('../../validators/validators');
const validateRequest = require('../../middleware/validationMiddleware/validateRequest');
const logger = require('../../logger');

// Endpoint do logowania
router.post('/', loginValidation, validateRequest, async(req, res) => {
    const { email, password, token2fa } = req.body;
    try {
        // Sprawdzenie, czy użytkownik istnieje i jest aktywny
        const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
        if (!user) {
            return res.status(401).json({ error: 'Niepoprawne dane logowania' });
        }

        // Pobierz pełne dane użytkownika z user_data (które zawierają first_name, last_name)
        const userDetails = await db.oneOrNone('SELECT * FROM public.user_data_department WHERE user_id = $1', [user.user_id]);

        if (!user.is_active) {
            return res.status(401).json({ error: 'Użytkownik nie jest aktywny' });
        }
        // Porównanie hasła
        const isMatch = await comparePasswords(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Niepoprawne dane logowania' });
        }

        // Sprawdzenie, czy 2FA jest włączone
        if( user.two_factor_secret) {
            // Jeśli 2FA jest włączone, sprawdź token 2FA
            if (!token2fa) {
                return res.status(200).json({ 
                    requires2FA: true, 
                    error: 'Token 2FA jest wymagany' 
                });
            }
            const { verify2FA } = require('../../modules/2faModules/2fa');
            const is2FAValid = await verify2FA(user.two_factor_secret, token2fa);
            if (!is2FAValid) {
                return res.status(200).json({ 
                    requires2FA: true, 
                    error: 'Niepoprawny token 2FA' 
                });
            }
            // Jeśli token 2FA jest poprawny, kontynuuj logowanie
        } 

        // Jeśli 2FA nie jest wymagane, wygeneruj token JWT i kontynuuj
        const token = jwt.sign({ userId: user.user_id, email: user.email, department_name: userDetails?.department_name || null }, process.env.JWT_SECRET, { 
            expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        });

        const isFirstLogin = user.last_login === null;
        
        // Ustawienie ciasteczek dla tokena 
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: process.env.SESSION_TIMEOUT // 1 godzina
        });

        // Aktualizacja ostatniego logowania tylko jeśli NIE jest to pierwsze logowanie
        // (zaktualizujemy po zmianie hasła)
        if (!isFirstLogin) {
            try {
                await db.oneOrNone('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE email = $1', [email]);
            } catch (err) {
                // Błąd podczas aktualizacji ostatniego logowania - loguj cicho
                logger.warn(`Błąd podczas aktualizacji ostatniego logowania dla użytkownika ${email}: ${err.message}`);
            }
        }
        
        const responseUser = {
            first_name: userDetails?.first_name || user.first_name,
            last_name: userDetails?.last_name || user.last_name,
            department_name: userDetails?.department_name || null,
            email: user.email,
        };
        
        logger.info(`Użytkownik ${user.email} zalogowany pomyślnie${isFirstLogin ? ' (pierwsze logowanie)' : ''}`);
        
        return res.status(200).json({ 
            message: 'Logged in successfully', 
            user: responseUser,
            requiresPasswordChange: isFirstLogin
        });
    } catch (error) {
        logger.error(`Nieudana próba logowania do konta ${email}: ${error.message}`);
        return res.status(500).json({ error: 'Nie udało się zalogować' });
    }
});

module.exports = {
    path: '/auth/login',
    router,
    routeName: 'login'
};