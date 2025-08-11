const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('ma_base_de_donnees.db');

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS utilisateurs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pseudo TEXT UNIQUE NOT NULL,
            mot_de_passe TEXT NOT NULL,
            score INTEGER DEFAULT 0,
            multiplier INTEGER DEFAULT 1,
            autoclicker INTEGER DEFAULT 0
        )
    `, (err) => {
        if (err) {
            console.error("Erreur lors de la création de la table utilisateurs :", err);
        } else {
            console.log("Table utilisateurs prête.");
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS pages_soon (
            page TEXT PRIMARY KEY
        )
    `, (err) => {
        if (err) {
            console.error("Erreur lors de la création de la table pages_soon :", err);
        } else {
            console.log("Table pages_soon prête.");
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS maintenance (
            enabled INTEGER DEFAULT 0
        )
    `, (err) => {
        if (err) {
            console.error("Erreur lors de la création de la table maintenance :", err);
        } else {
            // Insère la ligne si elle n'existe pas
            db.get("SELECT COUNT(*) AS count FROM maintenance", (err, row) => {
                if (row.count === 0) {
                    db.run("INSERT INTO maintenance (enabled) VALUES (0)");
                }
            });
            console.log("Table maintenance prête.");
        }
    });
});

db.close(() => {
    console.log("Initialisation terminée. Tu peux lancer ton serveur !");
});