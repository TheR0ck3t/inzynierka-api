const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db'); // Import bazy danych

router.get('/', (req, res) => {
    const { message } = req.body;
    console.log("✅ Odebrana wiadomość:", message);
    
    db.oneOrNone('SELECT * FROM TEST;')
        .then(data => {
            if (data) {
                console.log("Dane z bazy:", data);
                res.json({
                    status: 'success',
                    receivedMessage: message,
                    dbData: data
                });
            } else {
                console.log("Brak danych w tabeli TEST.");
                res.json({
                    status: 'success',
                    receivedMessage: message,
                    dbData: { data: 'Brak danych w tabeli TEST.' }
                });
            }
        })
        .catch(error => {
            console.error("Błąd podczas odczytu danych z bazy:", error);
        });
    // Odpowiedź do klienta
    
});

router.get('/test/:id', (req, res) => {

    db.oneOrNone('SELECT * FROM TEST WHERE id = $1;', [req.params.id])
        .then(data => {
            if (data) {
                console.log("Dane z bazy:", data);
                res.json({
                    status: 'success',
                    dbData: data
                });
            } else {
                console.log("Brak danych w tabeli TEST dla id:", req.params.id);
                res.json({
                    status: 'success',
                    dbData: { data: 'Brak danych w tabeli TEST dla podanego id.' }
                });
            }
        })
        .catch(error => {
            console.error("Błąd podczas odczytu danych z bazy:", error);
            res.status(500).json({ status: 'error', message: 'Błąd podczas odczytu danych z bazy.' });
        });
});

module.exports = {
    path: '/test',
    router,
    routeName: 'test'
};