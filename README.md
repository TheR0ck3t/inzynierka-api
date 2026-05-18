# Inżynierka API

Backend API do systemu zarządzania pracownikami - **projekt stworzony w ramach pracy inżynierskiej**.

## 📚 O Projekcie

Backend będący częścią zaawansowanego systemu do zarządzania dostępem pracowników z integracją RFID, komunikacji MQTT, obsługą 2FA i API REST do komunikacji z frontendem oraz mikrokontrolerami.

## 🚀 Technologie

### Podstawowe
- **Node.js** - środowisko uruchomieniowe JavaScript
- **Express.js 4.21.2** - framework webowy
- **PostgreSQL 12+** - baza danych relacyjna
- **pg-promise 11.10.2** - sterownik PostgreSQL

### Autoryzacja i Bezpieczeństwo
- **JWT (jsonwebtoken 9.0.2)** - autoryzacja tokenowa
- **bcrypt 6.0.0** - hashowanie haseł (10 rund soli)
- **OTPAuth 9.4.0** - TOTP (hasła jednorazowe oparte na czasie) dla 2FA
- **QRCode 1.5.4** - generowanie kodów QR
- **express-validator 7.2.1** - walidacja żądań
- **express-rate-limit 8.5.0** - ograniczenie liczby żądań

### Komunikacja w Czasie Rzeczywistym
- **Socket.IO 4.8.1** - WebSocket dla aktualizacji na żywo
- **MQTT 5.14** - komunikacja z czytnikami ESP32

### Narzędzia
- **Axios 1.8.2** - klient HTTP
- **Winston 3.17.0** - logowanie z rotacją
- **Nodemailer 8.0.5** - wysyłanie wiadomości e-mail
- **node-cron 4.2.1** - zaplanowane zadania
- **CORS 2.8.5** - obsługa żądań z różnych źródeł
- **cookie-parser 1.4.7** - zarządzanie ciasteczkami

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

## 📁 Struktura Projektu

```
src/
├── middleware/
│   ├── authToken.js            # Weryfikacja JWT
│   ├── validateRequest.js       # Centralna walidacja
│   ├── logAccess.js            # Logowanie dostępu
│   ├── workTimeTracker.js      # Śledzenie czasu pracy
│   └── mqttAuth.js             # Autoryzacja MQTT
├── modules/
│   ├── authModules/
│   │   └── userAuth.js         # Hashing, weryfikacja haseł
│   ├── 2faModules/
│   │   └── 2fa.js              # TOTP, generowanie kodów QR
│   └── dbModules/
│       └── db.js               # Konfiguracja PostgreSQL
├── routes/
│   ├── auth/                   # Trasowanie autoryzacji
│   │   ├── login.js            # POST /auth/login
│   │   ├── logout.js           # POST /auth/logout
│   │   ├── check.js            # GET /auth/check
│   │   └── 2fa.js              # Punkty końcowe 2FA
│   ├── accounts/               # Zarządzanie kontami
│   │   └── accounts.js         # CRUD użytkowników
│   ├── employees/              # Zarządzanie pracownikami
│   │   └── employees.js        # CRUD pracowników
│   ├── rfid/                   # RFID
│   │   ├── enrollment.js       # Enrolowanie kart
│   │   ├── access.js           # Weryfikacja dostępu
│   │   └── tags.js             # Zarządzanie tagami
│   └── logs/                   # Logi dostępu
│       └── accessLogs.js       # Historia dostępu
├── services/
│   ├── mqttService.js          # Klient brokera MQTT
│   ├── socketService.js        # Menedżer Socket.IO
│   ├── websocketBridge.js      # Most MQTT → WebSocket
│   └── statsScheduler.js       # Zadania cron
├── validators/
│   ├── authValidators.js       # Walidacja logowania, hasła, 2FA
│   ├── accountValidators.js    # Walidacja CRUD kont
│   ├── employeeValidators.js   # Walidacja CRUD pracowników
│   └── tagsValidators.js       # Walidacja tagów RFID
├── logger.js                   # Konfiguracja loggera Winston
└── api.js                      # Główny plik aplikacji

logs/                           # Pliki dziennika (tworzone automatycznie)
├── combined.log                # Wszystkie logi
├── error.log                   # Tylko błędy
generate-test-user.js           # Generator użytkownika testowego
.env.example                    # Szablon zmiennych środowiskowych
```

## 🔐 API Endpointy

### Autoryzacja (`/auth`)
| Endpoint | Metoda | Opis | Auth |
|----------|--------|------|---------| 
| `/auth/login` | POST | Logowanie użytkownika (z 2FA) | ❌ |
| `/auth/logout` | POST | Wylogowanie | ✅ |
| `/auth/check` | GET | Sprawdzenie sesji | ✅ |
| `/auth/2fa/enable` | POST | Włączenie 2FA + QR kod | ✅ |
| `/auth/2fa/disable` | POST | Wyłączenie 2FA | ✅ |
| `/auth/2fa/verify` | POST | Weryfikacja kodu 2FA | ❌ |

### Zarządzanie Kontami (`/accounts`)
| Endpoint | Metoda | Opis | Auth |
|----------|--------|------|---------| 
| `/accounts/` | GET | Lista użytkowników | ✅ |
| `/accounts/create` | POST | Tworzenie konta | ✅ |
| `/accounts/update/:id` | PUT | Aktualizacja konta | ✅ |
| `/accounts/delete/:id` | DELETE | Usunięcie konta | ✅ |
| `/accounts/changePassword` | PUT | Zmiana hasła | ✅ |

### Zarządzanie Pracownikami (`/employees`)
| Endpoint | Metoda | Opis | Auth |
|----------|--------|------|---------| 
| `/employees/` | GET | Lista pracowników | ✅ |
| `/employees/add` | POST | Dodanie pracownika | ✅ |
| `/employees/update/:id` | PUT | Aktualizacja pracownika | ✅ |
| `/employees/delete/:id` | DELETE | Usunięcie pracownika | ✅ |
| `/employees/:id` | GET | Szczegóły pracownika | ✅ |

### RFID & Enrolowanie (`/rfid`)
| Endpoint | Metoda | Opis | Auth |
|----------|--------|------|---------| 
| `/rfid/enrollment/start` | POST | Start enrolowania karty | ✅ |
| `/rfid/enrollment/save` | POST | Zapis scannowanej karty | ✅ |
| `/rfid/access/check` | POST | Weryfikacja dostępu (z MQTT) | ✅ |
| `/rfid/tags` | GET | Lista kart pracownika | ✅ |
| `/rfid/tags/add` | POST | Dodanie karty | ✅ |
| `/rfid/tags/delete/:id` | DELETE | Usunięcie karty | ✅ |
| `/rfid/secret/rotate` | POST | Rotacja sekretów dostępu | ✅ |

### Logi Dostępu (`/logs`)
| Endpoint | Metoda | Opis | Auth |
|----------|--------|------|---------| 
| `/logs/access` | GET | Historia dostępu | ✅ |
| `/logs/access/:id` | GET | Szczegóły logu | ✅ |

### Przestrzenie nazw WebSocket
| Namespace | Typ | Opis |
|-----------|------|-------|
| `/access-logs` | Socket.IO | Logi dostępu w czasie rzeczywistym |
| `/rfid` | Socket.IO | Komunikacja z kontrolerami |
| `/employees-status` | Socket.IO | Status pracowników (obecność) |

## � Endpointy Publiczne

### Publiczne
- `POST /auth/login` - Logowanie użytkownika (z 2FA)
- `POST /auth/2fa/verify` - Weryfikacja kodu 2FA

## 🔒 Bezpieczeństwo

### Autoryzacja
- **JWT (JSON Web Tokens)** - tokeny w ciasteczkach HTTP
- **2FA (TOTP)** - dwuskładnikowa autoryzacja z kodami czasowymi
- **Middleware `authToken`** - weryfikacja JWT na chronionych endpointach
- **Timeout sesji** - automatyczne wylogowanie po `SESSION_TIMEOUT`

### Hashing Haseł
- **bcrypt** - saltRounds = `BCRYPT_ROUNDS` (default: 10)
- Wymogi hasła: 8+ znaków, duże/małe litery, cyfra, znak specjalny

### Rate Limiting
- Limit requestów na IP
- Ochrona przed brute-force atakami

### MQTT Security
- Autoryzacja MQTT clients
- Middleware `mqttAuth` do weryfikacji komend

### Zmienne Bezpieczeństwa
```bash
JWT_SECRET=min_64_characters_long_for_security
JWT_EXPIRES_IN=1h
BCRYPT_ROUNDS=10
SESSION_TIMEOUT=3600000  # 1 godzina
```

## 🗄️ Baza Danych

Pełny schemat dostępny w `migrations/`

### Główne Tabele

**users** - Konta użytkowników
```sql
id SERIAL PRIMARY KEY
email VARCHAR(255) UNIQUE NOT NULL
password VARCHAR(255) NOT NULL
two_factor_secret VARCHAR(255)  -- TOTP secret
first_name VARCHAR(50)
last_name VARCHAR(50)
phone_number VARCHAR(15)
is_active BOOLEAN DEFAULT true
created_at TIMESTAMP DEFAULT NOW()
last_login TIMESTAMP
```

**employees** - Pracownicy
```sql
employee_id SERIAL PRIMARY KEY
first_name VARCHAR(50) NOT NULL
last_name VARCHAR(50) NOT NULL
dob DATE
employment_date DATE NOT NULL
employment_type VARCHAR(20)  -- PERMANENT, TEMPORARY, INTERN
user_id INTEGER REFERENCES users(id)
created_at TIMESTAMP DEFAULT NOW()
```

**rfid_tags** - Karty dostępu
```sql
tag_id SERIAL PRIMARY KEY
employee_id INTEGER REFERENCES employees(employee_id)
tag_uid VARCHAR(50) UNIQUE NOT NULL
secret VARCHAR(255)  -- Access token
status VARCHAR(20)  -- ACTIVE, REVOKED, EXPIRED
enrolled_at TIMESTAMP DEFAULT NOW()
```

**access_logs** - Historia dostępu
```sql
log_id SERIAL PRIMARY KEY
employee_id INTEGER REFERENCES employees(employee_id)
reader_id VARCHAR(50)  -- mainEntrance, mainExit, etc.
access_status VARCHAR(20)  -- ALLOWED, DENIED
scanned_at TIMESTAMP DEFAULT NOW()
```

**work_sessions** - Śledzenie czasu pracy
```sql
session_id SERIAL PRIMARY KEY
employee_id INTEGER REFERENCES employees(employee_id)
shift_start TIMESTAMP
shift_end TIMESTAMP
total_hours DECIMAL(5,2)
created_at TIMESTAMP DEFAULT NOW()
```

## � Konfiguracja (.env)

```bash
# Serwer
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=inzynierka_db

# JWT & Bezpieczeństwo
JWT_SECRET=your_secret_min_64_chars_long_for_security
JWT_EXPIRES_IN=1h
BCRYPT_ROUNDS=10
SESSION_TIMEOUT=3600000

# 2FA
COMPANY_NAME="Nazwa Twojej Firmy"

# MQTT (opcjonalnie)
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=user
MQTT_PASSWORD=password

# Email (dla notyfikacji)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

## 🔧 Narzędzia Developerskie

### Generowanie użytkowników testowych
```bash
node generate-test-user.js
```

Tworzy testowego użytkownika z włączonym 2FA.

### Monitorowanie logów
```bash
# Wszystkie logi
tail -f src/logs/combined.log

# Tylko błędy
tail -f src/logs/error.log
```


## 📡 Integracja z Innymi Komponentami

### Frontend (inzynierka-front)
- HTTP REST API
- WebSocket (Socket.IO) dla live updates
- 2FA QR code generation

### Kontroler RFID (inzynierka-kontroler)
- MQTT topics (`rfid/*`)
- REST API callbacks
- JWT authentication

### ESP32 Readers
- MQTT v5 protocol
- Enrolowanie kart
- Rotacja sekretów

## 🚦 Kody Odpowiedzi HTTP

| Kod | Opis |
|-----|------|
| `200` | ✅ OK - Sukces |
| `201` | ✅ Created - Zasób utworzony |
| `400` | ❌ Bad Request - Błędne dane wejściowe |
| `401` | ❌ Unauthorized - Brak autoryzacji / 2FA wymagane |
| `403` | ❌ Forbidden - Brak uprawnień |
| `404` | ❌ Not Found - Zasób nie znaleziony |
| `409` | ❌ Conflict - Konflikt (np. email już istnieje) |
| `422` | ❌ Unprocessable Entity - Walidacja nie powiodła się |
| `429` | ⚠️ Too Many Requests - Rate limit |
| `500` | ❌ Internal Server Error - Błąd serwera |
