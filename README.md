# Inżynierka API

Backend API do systemu zarządzania pracownikami - projekt inżynierski.

## 🚀 Technologie

- **Node.js** - środowisko uruchomieniowe JavaScript
- **Express.js 4.21.2** - framework webowy
- **PostgreSQL** - baza danych
- **pg-promise 11.10.2** - driver PostgreSQL
- **JWT (jsonwebtoken 9.0.2)** - autoryzacja
- **bcrypt 6.0.0** - hashowanie haseł
- **Winston 3.17.0** - logowanie
- **CORS 2.8.5** - obsługa cross-origin requests

## 📋 Wymagania

- Node.js (v16 lub nowszy)
- npm lub yarn
- PostgreSQL (v12 lub nowszy)
- Baza danych skonfigurowana zgodnie ze schematem

## 🛠️ Instalacja

1. Sklonuj repozytorium:
```bash
git clone <repository-url>
cd inzynierka-api
```

2. Zainstaluj zależności:
```bash
npm install
```

3. Skopiuj plik `.env.example` do `.env` i skonfiguruj zmienne środowiskowe:
```bash
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database
JWT_SECRET=your_jwt_secret_key
```

4. Skonfiguruj bazę danych PostgreSQL zgodnie ze schematem projektu.

## 🚀 Uruchomienie

### Tryb deweloperski (z nodemon)
```bash
npm run dev
```

### Tryb produkcyjny
```bash
npm start
```

API będzie dostępne na `http://localhost:3000`

## 📁 Struktura projektu

```
src/
├── modules/
│   ├── authModules/        # Moduły autoryzacji
│   │   ├── authToken.js    # Middleware JWT
│   │   └── userAuth.js     # Hashowanie i weryfikacja haseł
│   └── dbModules/
│       └── db.js           # Konfiguracja bazy danych
├── routes/
│   ├── accounts/           # Endpointy zarządzania kontami
│   │   └── accounts.js     # CRUD użytkowników
│   ├── auth/               # Endpointy autoryzacji
│   │   ├── login.js        # Logowanie
│   │   ├── logout.js       # Wylogowanie
│   │   └── check.js        # Sprawdzanie sesji
│   └── public/
│       └── test.js         # Publiczne endpointy testowe
├── logs/                   # Pliki logów
├── logger.js               # Konfiguracja Winston
api.js                      # Główny plik aplikacji
generate-test-user.js       # Skrypt generowania użytkowników testowych
```

## 🔐 API Endpointy

### Autoryzacja
- `POST /api/auth/login` - Logowanie użytkownika
- `POST /api/auth/logout` - Wylogowanie użytkownika
- `GET /api/auth/check` - Sprawdzanie stanu sesji

### Zarządzanie kontami
- `GET /api/accounts/` - Lista wszystkich użytkowników (wymagana autoryzacja)
- `POST /api/accounts/create` - Tworzenie nowego użytkownika (wymagana autoryzacja)
- `PUT /api/accounts/update/` - Aktualizacja danych użytkownika (wymagana autoryzacja)
- `DELETE /api/accounts/delete/:id` - Usunięcie użytkownika (wymagana autoryzacja)

### Publiczne
- `GET /api/public/test` - Endpoint testowy

## 🔒 Autoryzacja

API wykorzystuje JWT (JSON Web Tokens) do autoryzacji:
- Tokeny są przesyłane w nagłówku `Authorization: Bearer <token>`
- Middleware `authToken` sprawdza ważność tokenów
- Hasła są zabezpieczone przez bcrypt z saltRounds=10


## 🗄️ Baza danych

### Schemat tabeli `users`
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    two_factor_secret VARCHAR(255),
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    phone_number VARCHAR(15),
    is_active BOOLEAN DEFAULT FALSE
);

```

## 🛡️ Bezpieczeństwo

- **Hashowanie haseł**: bcrypt z salt rounds = 10
- **JWT**: zabezpieczone tokeny z ekspiracją
- **CORS**: skonfigurowane dla cross-origin requests
- **Walidacja**: express-validator dla validacji danych wejściowych
- **Zmienne środowiskowe**: wrażliwe dane w pliku .env

## 🔧 Narzędzia deweloperskie

### Generowanie użytkowników testowych
```bash
node generate-test-user.js
```

### Monitoring logów
```bash
tail -f src/logs/combined.log
```

## 🚦 Kody odpowiedzi HTTP

- `200` - OK (sukces)
- `400` - Bad Request (błędne dane)
- `401` - Unauthorized (brak autoryzacji)
- `404` - Not Found (nie znaleziono)
- `500` - Internal Server Error (błąd serwera)

 
