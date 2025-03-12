const express = require('express');
const cors = require('cors');
const db = require('./database'); // Import de la base de données

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json()); // Permet l'envoi de requêtes JSON
app.use(cors()); // Autorise les requêtes entre le frontend et le backend
app.use(express.static('public')); // Sert les fichiers frontend

// 🔹 Récupérer le score d'un joueur
app.get('/score/:username', (req, res) => {
    const { username } = req.params;
    db.get('SELECT cookies FROM players WHERE username = ?', [username], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ cookies: row ? row.cookies : 0 });
        }
    });
});

// 🔹 Mettre à jour le score d'un joueur
app.post('/click', (req, res) => {
    const { username } = req.body;

    db.run('INSERT INTO players (username, cookies) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET cookies = cookies + 1', 
        [username, 1], 
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                db.get('SELECT cookies FROM players WHERE username = ?', [username], (err, row) => {
                    res.json({ cookies: row.cookies });
                });
            }
        }
    );
});

// 🔹 Acheter un multiplicateur
app.post('/buy-multiplier', (req, res) => {
    const { username } = req.body;
    const cost = 50; // Prix fixe pour l'exemple

    db.get('SELECT cookies FROM players WHERE username = ?', [username], (err, row) => {
        if (row.cookies >= cost) {
            db.run('UPDATE players SET cookies = cookies - ?, multiplier = multiplier * 2 WHERE username = ?', 
                [cost, username], 
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, cookies: row.cookies - cost });
                }
            );
        } else {
            res.json({ success: false });
        }
    });
});

// 🔹 Acheter un autoclicker
app.post('/buy-autoclicker', (req, res) => {
    const { username } = req.body;
    const cost = 100; // Prix fixe

    db.get('SELECT cookies, autoclicker FROM players WHERE username = ?', [username], (err, row) => {
        if (row.cookies >= cost && !row.autoclicker) {
            db.run('UPDATE players SET cookies = cookies - ?, autoclicker = 1 WHERE username = ?', 
                [cost, username], 
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, cookies: row.cookies - cost });
                }
            );
        } else {
            res.json({ success: false });
        }
    });
});


// 🔹 Démarrer le serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});