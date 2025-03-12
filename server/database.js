const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Assurer que le dossier data/ existe
const dataPath = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath); // Crée le dossier s'il n'existe pas
}

// Définir le chemin de la base de données
const dbPath = path.resolve(dataPath, 'database.db');

// Ouvrir la base de données SQLite
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erreur lors de la connexion à SQLite:', err.message);
    } else {
        console.log(`✅ Base de données SQLite créée/utilisée à : ${dbPath}`);
    }
});

// Créer la table des joueurs si elle n'existe pas
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            cookies INTEGER DEFAULT 0
        )
    `);
});

module.exports = db;
