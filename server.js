const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();
const db = new sqlite3.Database('ma_base_de_donnees.db');
const classementFile = path.join(__dirname, 'classement_cache.json');

// === MIDDLEWARE MAINTENANCE ===
app.use((req, res, next) => {
    db.get('SELECT enabled FROM maintenance', (err, row) => {
        if (err) {
            console.error('[MAINTENANCE] Erreur SQLite :', err);
            return next();
        }
        const blocked = [
            '/index.html', '/index',
            '/shop.html', '/shop',
            '/classement.html', '/classement'
        ];
        if (
            row && row.enabled === 1 &&
            blocked.includes(req.path) &&
            req.path !== '/soon.html' &&
            !req.path.startsWith('/admin')
        ) {
            console.log(`[MAINTENANCE] Redirection ${req.path} vers /soon.html`);
            return res.redirect('/soon.html');
        }
        next();
    });
});

// Middleware JSON
app.use(bodyParser.json());

// Sessions
app.use(session({
    secret: 'votre_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Création des tables
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
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS pages_soon (
            page TEXT PRIMARY KEY
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS maintenance (
            enabled INTEGER DEFAULT 0
        )
    `);
});

const ADMIN_PASSWORD_HASH = "f82addfaee78077ad97b4cdc3daf509842a1c162e2649471fb25263153f7de42";

// Auth admin
app.post('/admin-login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD_HASH) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ message: "Mot de passe incorrect" });
    }
});

function isAdmin(req, res, next) {
    if (req.session.isAdmin) next();
    else res.status(403).json({ message: "Accès refusé" });
}

app.post('/admin-reset-scores', isAdmin, (req, res) => {
    db.run('UPDATE utilisateurs SET score = 0', (err) => {
        if (err) {
            return res.status(500).json({ message: "Erreur lors de la réinitialisation" });
        }
        res.json({ message: "Tous les scores ont été réinitialisés !" });
    });
});

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login.html');
    }
}

// Inscription
app.post('/inscription', (req, res) => {
    const { nom_utilisateur, mot_de_passe } = req.body;

    if (!nom_utilisateur || !mot_de_passe) {
        return res.status(400).json({ message: 'Nom d\'utilisateur et mot de passe requis' });
    }

    db.run(
        'INSERT INTO utilisateurs (pseudo, mot_de_passe) VALUES (?, ?)',
        [nom_utilisateur, mot_de_passe],
        function (err) {
            if (err) {
                return res.status(400).json({ message: 'Ce nom d\'utilisateur est déjà pris' });
            }
            res.json({ message: 'Inscription réussie' });
        }
    );
});

// Connexion
app.post('/connexion', (req, res) => {
    const { nom_utilisateur, mot_de_passe } = req.body;

    if (!nom_utilisateur || !mot_de_passe) {
        return res.status(400).json({ message: 'Nom d\'utilisateur et mot de passe requis' });
    }

    db.get(
        'SELECT * FROM utilisateurs WHERE pseudo = ? AND mot_de_passe = ?',
        [nom_utilisateur, mot_de_passe],
        (err, row) => {
            if (err || !row) {
                return res.status(400).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
            }

            req.session.user = row.pseudo;
            res.json({ message: 'Connexion réussie', nom_utilisateur: row.pseudo });
        }
    );
});

// Vérif auth
app.get('/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, nom_utilisateur: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

// Déconnexion
app.post('/deconnexion', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Erreur lors de la déconnexion' });
        }
        res.json({ message: 'Déconnexion réussie' });
    });
});

// Changer mot de passe
app.post('/changer-mot-de-passe', (req, res) => {
    const { ancienMotDePasse, nouveauMotDePasse } = req.body;
    const pseudo = req.session.user;

    if (!pseudo) {
        return res.status(400).json({ error: 'Utilisateur non connecté' });
    }

    db.get(
        'SELECT * FROM utilisateurs WHERE pseudo = ? AND mot_de_passe = ?',
        [pseudo, ancienMotDePasse],
        (err, row) => {
            if (err || !row) {
                return res.status(400).json({ error: 'Ancien mot de passe incorrect' });
            }

            db.run(
                'UPDATE utilisateurs SET mot_de_passe = ? WHERE pseudo = ?',
                [nouveauMotDePasse, pseudo],
                function (err) {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur lors de la mise à jour du mot de passe' });
                    }

                    res.json({ message: 'Mot de passe mis à jour avec succès' });
                }
            );
        }
    );
});

// Click
app.post('/click', (req, res) => {
    const { multiplier } = req.body;
    const pseudo = req.session.user;

    if (!pseudo) {
        return res.status(400).json({ error: 'Utilisateur non connecté' });
    }

    db.run(
        'UPDATE utilisateurs SET score = score + ? WHERE pseudo = ?',
        [multiplier, pseudo],
        function (err) {
            if (err) {
                console.error("Erreur lors de la mise à jour du score :", err);
                return res.status(500).json({ error: 'Erreur lors de la mise à jour du score' });
            }

            db.get(
                'SELECT score FROM utilisateurs WHERE pseudo = ?',
                [pseudo],
                (err, row) => {
                    if (err || !row) {
                        console.error("Erreur lors de la récupération du score :", err);
                        return res.status(500).json({ error: 'Erreur lors de la récupération du score' });
                    }

                    res.json({ score: row.score });
                }
            );
        }
    );
});

// Récup score
app.get('/score', (req, res) => {
    const pseudo = req.session.user;

    if (!pseudo) {
        return res.status(400).json({ error: 'Utilisateur non connecté' });
    }

    db.get(
        'SELECT score FROM utilisateurs WHERE pseudo = ?',
        [pseudo],
        (err, row) => {
            if (err || !row) {
                return res.status(500).json({ error: 'Erreur lors de la récupération du score' });
            }
            res.json({ score: row.score });
        }
    );
});

// Reset score
app.post('/reset', (req, res) => {
    const pseudo = req.session.user;

    if (!pseudo) {
        return res.status(400).json({ error: 'Utilisateur non connecté' });
    }

    db.run(
        'UPDATE utilisateurs SET score = 0 WHERE pseudo = ?',
        [pseudo],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Erreur lors de la réinitialisation du score' });
            }
            res.json({ success: true });
        }
    );
});

// Achat multiplicateur
app.post('/buy-multiplier', (req, res) => {
    const pseudo = req.session.user;

    if (!pseudo) {
        return res.status(400).json({ error: 'Utilisateur non connecté' });
    }

    db.get(
        'SELECT score FROM utilisateurs WHERE pseudo = ?',
        [pseudo],
        (err, row) => {
            if (err || !row) {
                return res.status(500).json({ error: 'Erreur lors de la récupération du score' });
            }

            if (row.score >= 900) {
                db.run(
                    'UPDATE utilisateurs SET score = score - 900, multiplier = 2 WHERE pseudo = ?',
                    [pseudo],
                    function (err) {
                        if (err) {
                            return res.status(500).json({ error: 'Erreur lors de la mise à jour du score' });
                        }
                        res.json({ success: true });
                    }
                );
            } else {
                res.json({ success: false, message: 'Pas assez de cookies' });
            }
        }
    );
});

// Achat autoclicker
app.post('/buy-autoclicker', (req, res) => {
    const pseudo = req.session.user;

    if (!pseudo) {
        return res.status(400).json({ error: 'Utilisateur non connecté' });
    }

    db.get(
        'SELECT score FROM utilisateurs WHERE pseudo = ?',
        [pseudo],
        (err, row) => {
            if (err || !row) {
                return res.status(500).json({ error: 'Erreur lors de la récupération du score' });
            }

            if (row.score >= 5000) {
                db.run(
                    'UPDATE utilisateurs SET score = score - 5000, autoclicker = 1 WHERE pseudo = ?',
                    [pseudo],
                    function (err) {
                        if (err) {
                            return res.status(500).json({ error: 'Erreur lors de la mise à jour du score' });
                        }
                        res.json({ success: true });
                    }
                );
            } else {
                res.json({ success: false, message: 'Pas assez de cookies' });
            }
        }
    );
});

// Récup améliorations
app.get('/upgrades', (req, res) => {
    const pseudo = req.session.user;

    if (!pseudo) {
        return res.status(400).json({ error: 'Utilisateur non connecté' });
    }

    db.get(
        'SELECT multiplier, autoclicker FROM utilisateurs WHERE pseudo = ?',
        [pseudo],
        (err, row) => {
            if (err || !row) {
                return res.status(500).json({ error: 'Erreur lors de la récupération des améliorations' });
            }
            res.json({ multiplier: row.multiplier, autoclicker: row.autoclicker });
        }
    );
});

// Pages
app.get('/', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/shop', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'shop.html'));
});

app.get('/classement', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'classement.html'));
});

app.get('/soon', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'soon.html'));
});

// Admin soon
app.post('/admin/soon', isAdmin, (req, res) => {
    const { page } = req.body;
    db.run('INSERT OR IGNORE INTO pages_soon (page) VALUES (?)', [page], (err) => {
        if (err) return res.status(500).json({ message: "Erreur lors de l'activation" });
        res.json({ message: `La page ${page} est maintenant redirigée vers soon.html` });
    });
});

app.post('/admin/unssoon', isAdmin, (req, res) => {
    const { page } = req.body;
    db.run('DELETE FROM pages_soon WHERE page = ?', [page], (err) => {
        if (err) return res.status(500).json({ message: "Erreur lors de la désactivation" });
        res.json({ message: `La page ${page} est maintenant accessible normalement` });
    });
});

app.get('/admin/soon-list', isAdmin, (req, res) => {
    db.all('SELECT page FROM pages_soon', (err, rows) => {
        if (err) return res.status(500).json({ message: "Erreur lors de la récupération" });
        res.json({ pages: rows.map(r => r.page) });
    });
});

// Maintenance
app.post('/admin/maintenance-on', isAdmin, (req, res) => {
    db.run('UPDATE maintenance SET enabled = 1', (err) => {
        if (err) {
            return res.status(500).json({ message: "Erreur activation maintenance" });
        }
        res.json({ message: "Le site est maintenant en maintenance (soon.html)" });
    });
});

app.post('/admin/maintenance-off', isAdmin, (req, res) => {
    db.run('UPDATE maintenance SET enabled = 0', (err) => {
        if (err) {
            return res.status(500).json({ message: "Erreur désactivation maintenance" });
        }
        res.json({ message: "Le site est de nouveau accessible" });
    });
});

// Cache classement
function updateClassementCache() {
    db.all('SELECT pseudo, score FROM utilisateurs ORDER BY score DESC', (err, rows) => {
        if (!err) {
            fs.writeFileSync(classementFile, JSON.stringify(rows, null, 2));
        }
    });
}

updateClassementCache();
setInterval(updateClassementCache, 60 * 60 * 1000);

app.get('/classement-data', (req, res) => {
    if (fs.existsSync(classementFile)) {
        const data = fs.readFileSync(classementFile);
        res.json({ classement: JSON.parse(data) });
    } else {
        res.json({ classement: [] });
    }
});

// Start serveur
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Cookie Clicker allumé http://localhost:${PORT}`);
});
