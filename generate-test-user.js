require('dotenv').config();
const db = require('./src/modules/dbModules/db');
const bcrypt = require('bcrypt');

async function createTestUser() {
  // Dane testowego użytkownika
  const testUser = {
    email: 'test@example.com',
    password: '123456', // To hasło zostanie zaszyfrowane
    firstName: 'Test',
    lastName: 'User',
    is_active: true
  };

  try {
    // Sprawdź, czy użytkownik już istnieje
    const existingUser = await db.oneOrNone('SELECT * FROM user_data WHERE email = $1', [testUser.email]);
    
    if (existingUser) {
      console.log('Użytkownik testowy już istnieje');
      process.exit(0);
    }
    
    // Zaszyfruj hasło
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(testUser.password, saltRounds);
    
    // Dodaj użytkownika do bazy danych
    const result = await db.one(`
      INSERT INTO users (email, password, is_active, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      RETURNING user_id, email
    `, [testUser.email, hashedPassword, testUser.is_active]);
    
    console.log('Utworzono użytkownika testowego:', result);
  } catch (error) {
    console.error('Błąd podczas tworzenia użytkownika testowego:', error);
  } finally {
    process.exit(0);
  }
}

createTestUser();
