const qrcode = require('qrcode');
const { TOTP, Secret } = require('otpauth');
const logger = require('../../logger');

async function generateSecret(userEmail) {
    try {
        // Najpierw TOTP, potem pobierz secret
        const totp = new TOTP({
            issuer: process.env.COMPANY_NAME || 'Inżynierka',
            label: userEmail,
            algorithm: 'SHA256',
            digits: 6,
            period: 30,
        });
        logger.info(`Generated 2FA secret for user: ${userEmail}`);
        return {
            secret: totp.secret.base32, // Zwraca secret w formacie base32
            otpauthUrl: totp.toString(), // Zwraca URL do otpauth
        }
    } catch (error) {
        logger.error(`Error generating 2FA secret: ${error.message}`);
        throw new Error('Failed to generate 2FA secret');
    }
}

async function generateQRCode(otpauthUrl) {
    try {
        // Sprawdź czy to prawidłowy URL
        if (!otpauthUrl || !otpauthUrl.startsWith('otpauth://')) {
            throw new Error('Invalid otpauth URL format');
        }
        
        const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl, {
            width: 256,
            margin: 2
        });
        return qrCodeDataUrl;

    } catch (error) {
        logger.error(`Error generating QR code: ${error.message}`);
        throw new Error('Failed to generate QR code');   
    }
}

async function verify2FA(secret, token) {
    logger.info(`Verifying 2FA token`);
    try {
        const totp = new TOTP({
            secret: Secret.fromBase32(secret), // Jak w GitHub
            algorithm: 'SHA256',
            digits: 6,
            period: 30,
        });

        return totp.validate({ token, window: 1 }) !== null;
    } catch (error) {
        logger.error(`Error verifying 2FA: ${error.message}`);
        return false;
    }
}

module.exports = {
    generateSecret,
    generateQRCode,
    verify2FA,
};