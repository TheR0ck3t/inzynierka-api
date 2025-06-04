const bcrypt = require('bcrypt');

// Hashowanie hasła
async function hashPassword(password) {
    const hashedPassword = await bcrypt.hash(password, 10);
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