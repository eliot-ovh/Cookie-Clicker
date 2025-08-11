const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('ma_base_de_donnees.db');

db.serialize(() => {
    db.run("DELETE FROM maintenance", (err) => {
        if (err) console.error(err);
        db.run("INSERT INTO maintenance (enabled) VALUES (0)", (err) => {
            if (err) console.error(err);
            else console.log("Ligne maintenance insérée !");
            db.close();
        });
    });
});