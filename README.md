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
- **OTPAuth 9.4.0** - obsługa TOTP (2FA)
- **QRCode 1.5.4** - generowanie kodów QR dla 2FA

## 📋 Wymagania

- Node.js (v16 lub nowszy)
- npm lub yarn
- PostgreSQL (v12 lub nowszy)
- Baza danych skonfigurowana zgodnie ze schematem

## 🛠️ Instalacja

1. Sklonuj repozytorium:
```bash
git clone https://github.com/TheR0ck3t/inzynierka-api.git
cd inzynierka-api
```

2. Zainstaluj zależności:
```bash
npm install
```

3. Skopiuj plik `.env.example` do `.env` i skonfiguruj zmienne środowiskowe:
```bash
cp .env.example .env
```

Następnie edytuj plik `.env` zgodnie z twoją konfiguracją:
```bash
# Przykładowa konfiguracja

# Serwer
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Baza danych PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database

# JWT i bezpieczeństwo
JWT_SECRET=your_jwt_secret_key_min_64_characters_long_for_security
JWT_EXPIRES_IN=1h
SESSION_TIMEOUT=3600000
BCRYPT_ROUNDS=10

# 2FA
COMPANY_NAME="Twoja Firma"
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
│   │   └── userAuth.js     # Hashowanie i weryfikacja haseł
│   ├── 2faModules/         # Moduły 2FA
│   │   └── 2fa.js          # TOTP, generowanie QR kodów
│   └── dbModules/
│       └── db.js           # Konfiguracja bazy danych
├── middleware/
│   └── authToken.js        # Middleware JWT
├── routes/
│   ├── accounts/           # Endpointy zarządzania kontami
│   │   └── accounts.js     # CRUD użytkowników
│   ├── auth/               # Endpointy autoryzacji
│   │   ├── login.js        # Logowanie (z obsługą 2FA)
│   │   ├── logout.js       # Wylogowanie
│   │   ├── check.js        # Sprawdzanie sesji
│   │   └── 2fa.js          # Endpointy 2FA (QR kody, weryfikacja)
│   └── employees/          # Endpointy zarządzania pracownikami
│       └── employees.js    # CRUD pracowników
├── logs/                   # Pliki logów (tworzone automatycznie)
│   ├── combined.log        # Wszystkie logi
│   └── error.log           # Tylko błędy
└── logger.js               # Konfiguracja Winston
.env.example                # Przykładowy plik konfiguracyjny
api.js                      # Główny plik aplikacji
generate-test-user.js       # Skrypt generowania użytkowników testowych
```

## 🔐 API Endpointy

### Autoryzacja
- `POST /auth/login` - Logowanie użytkownika
- `POST /auth/logout` - Wylogowanie użytkownika
- `GET /auth/check` - Sprawdzanie stanu sesji
- `POST /auth/2fa/enable` - Dodawanie 2FA
- `POST /auth/2fa/disable` - Usuwanie 2FA

### Zarządzanie kontami
- `GET /accounts/` - Lista wszystkich użytkowników (wymagana autoryzacja)
- `POST /accounts/create` - Tworzenie nowego użytkownika (wymagana autoryzacja)
- `PUT /accounts/update/` - Aktualizacja danych użytkownika (wymagana autoryzacja)
- `DELETE /accounts/delete/:id` - Usunięcie użytkownika (wymagana autoryzacja)

### Zarządzanie pracownikami
- `GET /employees/` - Lista wszystkich pracowników (wymagana autoryzacja)
- `POST /employees/add` - Dodawanie nowego pracownika (wymagana autoryzacja)
- `PUT /employees/update/` - Aktualizacja danych pracownika (wymagana autoryzacja)
- `DELETE /employees/delete/:id` - Usunięcie pracownika (wymagana autoryzacja)

### Publiczne
- Brak publicznych endpointów (wszystkie wymagają autoryzacji)

## 🔒 Autoryzacja

API wykorzystuje JWT (JSON Web Tokens) do autoryzacji:
- Tokeny są przesyłane w ciasteczkach HTTP (`token`)
- Middleware `authToken` sprawdza ważność tokenów dla chronionych endpointów
- Hasła są zabezpieczone przez bcrypt z saltRounds= `BCRYPT_ROUNDS`
- Czas wygaśnięcia tokena konfigurowalny przez `JWT_EXPIRES_IN`


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

### Schemat tabeli `employees`
```sql
CREATE TABLE employees (
    employee_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    dob DATE,
    employment_date DATE,
    keycard_id VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🛡️ Bezpieczeństwo

- **Hashowanie haseł**: bcrypt z salt rounds = 10
- **JWT**: zabezpieczone tokeny z ekspiracją (konfigurowalny czas przez `JWT_EXPIRES_IN`)
- **CORS**: skonfigurowane dla cross-origin requests
- **Zmienne środowiskowe**: wrażliwe dane zabezpieczone w pliku .env
- **Middleware autoryzacji**: `authToken` chroni wszystkie endpointy

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