const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const port = process.env.PORT;

// Middleware
app.use(cors());
app.use(express.json());

// Rate Limiting (30 requêtes/minute)
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30
});
app.use(limiter);

// Connexion MySQL
const pool = mysql.createPool({
    host: process.env.localhost,
    user: process.env.root,
    password: process.env.coucou,
    database: process.env.cookie_clicker,
    waitForConnections: true,
    connectionLimit: 10
});

// Récupérer le score
app.get('/api/score', async (req, res) => {
    const ip = req.ip.replace('::ffff:', ''); // Adresse IPv4
    try {
        const [rows] = await pool.query(
            'SELECT score FROM clicker_saves WHERE ip_address = ?', 
            [ip]
        );
        res.json(rows[0] || { score: 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mettre à jour le score
app.post('/api/score', async (req, res) => {
    const ip = req.ip.replace('::ffff:', '');
    const score = req.body.score;

    // Validation
    if (typeof score !== 'number') {
        return res.status(400).json({ error: "Score invalide" });
    }

    try {
        await pool.query(
            `INSERT INTO clicker_saves (ip_address, score)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE score = ?`,
            [ip, score, score]
        );
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Démarrer le serveur
app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});