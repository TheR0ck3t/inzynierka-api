const bcrypt = require('bcrypt');

// Hashowanie hasła
async function hashPassword(password) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}

// Porównywanie hasła z hashem
async function comparePasswords(password, hashedPassword) {
    const result = await bcrypt.compare(password, hashedPassword);
    return result;
}



module.exports = {
    hashPassword,
    comparePasswords,
};