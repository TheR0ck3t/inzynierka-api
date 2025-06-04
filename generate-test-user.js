require('dotenv').config();
const db = require('./src/modules/dbModules/db');
const bcrypt = require('bcrypt');

async function createTestUser() {
  // Dane testowego użytkownika
  const testUser = {
    email: 'dominik.makowski@student.ajp.edu.pl',
    password: 'UwU_OwO', // To hasło zostanie zaszyfrowane
    firstName: 'Dominik',
    lastName: 'Mąkowski',
    is_active: true
  };

  try {
    // Sprawdź, czy użytkownik już istnieje
    const existingUser = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [testUser.email]);
    
    if (existingUser) {
      console.log('Użytkownik testowy już istnieje');
      process.exit(0);
    }
    
    // Zaszyfruj hasło
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(testUser.password, saltRounds);
    
    // Dodaj użytkownika do bazy danych
    const result = await db.one(`
      INSERT INTO users (email, password, first_name, last_name, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING id, email
    `, [testUser.email, hashedPassword, testUser.firstName, testUser.lastName, testUser.is_active]);
    
    console.log('Utworzono użytkownika testowego:', result);
  } catch (error) {
    console.error('Błąd podczas tworzenia użytkownika testowego:', error);
  } finally {
    process.exit(0);
  }
}

createTestUser();