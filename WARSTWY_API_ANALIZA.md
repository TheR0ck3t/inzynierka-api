# Analiza warstwowa API (projektowo-biznesowa)

## 1. Kontekst biznesowy API

API realizuje cztery główne zdolności biznesowe systemu RFID:
- zarządzanie tożsamością i dostępem pracowników (konta, role, 2FA, sesje),
- zarządzanie personelem i strukturą organizacji (pracownicy, typy zatrudnienia, działy),
- kontrola fizycznego dostępu RFID (tagi, czytniki, decyzja ALLOW/DENIED, rotacja secret),
- ewidencja i analityka czasu pracy oraz zdarzeń bezpieczeństwa (logi, statystyki, realtime).

Na tej podstawie poprawny podział techniczny powinien utrzymywać jasne granice odpowiedzialności między warstwami.

## 2. Docelowe 4 warstwy

### Warstwa 1: Prezentacji (API/transport)
Odpowiedzialność:
- przyjęcie żądania HTTP/WS,
- mapowanie input/output (request/response),
- wywołanie logiki biznesowej,
- zwrot kodu HTTP i DTO odpowiedzi.

Pliki (obecna lokalizacja):
- src/routes/auth/login.js
- src/routes/auth/logout.js
- src/routes/auth/check.js
- src/routes/auth/verify.js
- src/routes/auth/change-password.js
- src/routes/auth/2fa.js
- src/routes/accounts/accounts.js
- src/routes/employees/employees.js
- src/routes/employees/employmentTypes.js
- src/routes/tags/tags.js
- src/routes/readers/readers.js
- src/routes/stats/workStats.js
- src/routes/security/logs.js
- src/routes/health/health.js
- src/services/webSocketService/websocket.js
- src/services/webSocketService/rfidControllerWebsocket.js
- src/services/webSocketService/accessLogsWebSocket.js
- src/services/webSocketService/employeesStatusWebSocket.js
- src/services/webSocketService/readersListWebSocket.js

Wniosek:
- warstwa prezentacji jest obecna i rozbudowana,
- aktualnie część tras zawiera SQL i reguły domenowe (przeciek odpowiedzialności).

### Warstwa 2: Middleware (przekrojowa polityka wejścia)
Odpowiedzialność:
- autentykacja i autoryzacja,
- walidacja/sanitacja danych wejściowych,
- techniczne logowanie requestów,
- polityki bezpieczeństwa transportu.

Pliki:
- src/middleware/authMiddleware/authToken.js
- src/middleware/authMiddleware/mqttAuth.js
- src/middleware/validationMiddleware/validateRequest.js
- src/validators/authValidators.js
- src/validators/accountValidators.js
- src/validators/employeeValidators.js
- src/validators/tagsValidators.js
- src/validators/readerValidators.js
- src/validators/sqlSanitizer.js
- src/validators/validators.js
- src/middleware/loggingMiddleware/httpLogger.js

Wniosek:
- middleware autoryzacji i walidacji jest poprawnie wydzielony,
- auth faktycznie należy tutaj (zgodnie z Twoją obserwacją), ale tylko w zakresie kontroli dostępu; logika haseł i 2FA należy do warstwy biznesowej.

### Warstwa 3: Logika biznesowa (use-case/domain)
Odpowiedzialność:
- reguły i procesy biznesowe (konto, hasło, 2FA, enrollment RFID, rotacja secret, status pracy),
- orkiestracja operacji wieloetapowych,
- koordynacja repozytoriów i integracji.

Pliki już pasujące do tej warstwy:
- src/modules/authModules/userAuth.js (hash/compare hasła)
- src/modules/2faModules/2fa.js (generowanie i weryfikacja TOTP)
- src/services/mailService/mailService.js (use-case wysyłki powiadomień)
- src/services/statsService/statsScheduler.js (procesy cykliczne)

Pliki/funkcje, które obecnie są poza warstwą biznesową, ale powinny do niej trafić:
- z src/routes/auth/login.js:
  - proces logowania, sprawdzanie pierwszego logowania, obsługa 2FA,
- z src/routes/accounts/accounts.js:
  - tworzenie konta + transakcja + wysyłka maila aktywacyjnego,
- z src/routes/tags/tags.js:
  - proces enrollment RFID,
  - decyzja dostępu (ALLOW/DENIED),
  - rotacja secret i locki per tag,
- z src/middleware/statsMiddleware/workTimeTracker.js:
  - zmiana statusu pracy (start/stop sesji) to reguła biznesowa, nie middleware,
- z src/middleware/loggingMiddleware/readerAccesLog.js:
  - logowanie zdarzenia domenowego dostępu (security event) powinno być wywoływane jako serwis use-case, nie jako middleware zależne od req.

### Warstwa 4: Dostęp do danych (persistence)
Odpowiedzialność:
- połączenie z DB,
- transakcje,
- zapytania SQL i repozytoria.

Pliki:
- src/modules/dbModules/db.js
- (docelowo) repozytoria np. src/repositories/*.js dla users, employees, tags, readers, workSessions, accessLogs.

Wniosek:
- rdzeń dostępu do danych istnieje,
- większość SQL jest dziś rozsiana w routes i middleware; należy ją skonsolidować w repozytoriach.

## 3. Przypisanie funkcji do warstw (reguły podziału)

### Prezentacja
- tylko: parse request, wywołanie use-case, mapowanie odpowiedzi,
- bez: SQL, transakcji, rotacji secret, decyzji domenowych.

### Middleware
- tylko: authToken, mqttAuth, validateRequest, walidatory, httpLogger,
- bez: modyfikacji danych domenowych (np. work_sessions, access_logs).

### Logika biznesowa
- tylko: reguły i procesy (auth, 2FA, enrollment, access decision, rotacja, statystyki),
- bez: bezpośredniej zależności od Express req/res.

### Dostęp do danych
- tylko: SQL i transakcje,
- bez: walidacji HTTP, JWT, formatowania response.

## 4. Konkretne przesunięcia funkcji (najważniejsze)

1. Auth do middleware:
- zostawić w middleware:
  - authToken.js,
  - mqttAuth.js,
  - namespaceJwtAuth/namespaceApiKeyAuth (socketAuth.js).

2. Auth biznesowy do logiki biznesowej:
- utrzymać/rozwinąć w serwisach:
  - hashPassword/comparePasswords,
  - verify2FA/generateSecret/generateQRCode,
  - logowanie użytkownika (dziś w route).

3. Operacje DB do warstwy dostępu do danych:
- przenieść SQL z routes/* i workTimeTracker/readerAccesLog do repozytoriów.

4. RFID i czas pracy do logiki biznesowej:
- enrollment, access check, rotacja secret, start/stop sesji pracy jako use-case services,
- route i middleware mają tylko wywołać serwis.

## 5. Proponowany docelowy układ katalogów

- src/presentation/http/routes/*
- src/presentation/ws/*
- src/middleware/*
- src/application/services/*
- src/domain/* (opcjonalnie: encje, polityki)
- src/infrastructure/repositories/*
- src/infrastructure/db/db.js
- src/infrastructure/messaging/mqtt/*
- src/infrastructure/mail/*

## 6. Podsumowanie oceny obecnej architektury

- Twoja obserwacja o 4 warstwach jest trafna i spójna biznesowo.
- Największa luka: przeciążenie warstwy prezentacji i middleware logiką biznesową oraz SQL.
- Największa korzyść po refaktorze: łatwiejsze testy, mniej regresji, czytelny podział odpowiedzialności, prostszy rozwój nowych funkcji RFID i HR.
