require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');

const app = express();
const db = new sqlite3.Database('ma_base_de_donnees.db');

// Middleware pour parser les requêtes POST
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // À activer si HTTPS
}));

// Servir les fichiers statiques (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Créer la table utilisateurs si elle n'existe pas
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS utilisateurs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pseudo TEXT UNIQUE NOT NULL,
            mot_de_passe TEXT NOT NULL,
            score INTEGER DEFAULT 0,
            multiplier INTEGER DEFAULT 1,  -- Nouveau champ pour le multiplicateur
            autoclicker INTEGER DEFAULT 0  -- Nouveau champ pour l'autoclicker (0 = désactivé, 1 = activé)
        )
    `, (err) => {
        if (err) {
            console.error("Erreur lors de la création de la table utilisateurs :", err);
        } else {
            console.log("Table utilisateurs prête.");
        }
    });
});

// Middleware pour vérifier si l'utilisateur est connecté
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login.html');
    }
}

// Route pour l'inscription
app.post('/inscription', async (req, res) => {
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

// Route pour la connexion
app.post('/connexion', async (req, res) => {
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

            // Créer une session pour l'utilisateur
            req.session.user = row.pseudo;
            res.json({ message: 'Connexion réussie', nom_utilisateur: row.pseudo });
        }
    );
});

// Route pour vérifier si l'utilisateur est connecté
app.get('/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, nom_utilisateur: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

// Route pour déconnecter l'utilisateur
app.post('/deconnexion', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Erreur lors de la déconnexion' });
        }
        res.json({ message: 'Déconnexion réussie' });
    });
});

// Route pour changer le mot de passe
app.post('/changer-mot-de-passe', async (req, res) => {
    const { ancienMotDePasse, nouveauMotDePasse } = req.body;
    const pseudo = req.session.user;

    if (!pseudo) {
        return res.status(400).json({ error: 'Utilisateur non connecté' });
    }

    // Vérifier si l'ancien mot de passe est correct
    db.get(
        'SELECT * FROM utilisateurs WHERE pseudo = ? AND mot_de_passe = ?',
        [pseudo, ancienMotDePasse],
        (err, row) => {
            if (err || !row) {
                return res.status(400).json({ error: 'Ancien mot de passe incorrect' });
            }

            // Mettre à jour le mot de passe
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

// Route pour enregistrer un clic
app.post('/click', async (req, res) => {
    const { multiplier } = req.body;
    const pseudo = req.session.user;

    if (!pseudo) {
        return res.status(400).json({ error: 'Utilisateur non connecté' });
    }

    // Incrémenter le score de l'utilisateur
    db.run(
        'UPDATE utilisateurs SET score = score + ? WHERE pseudo = ?',
        [multiplier, pseudo],
        function (err) {
            if (err) {
                console.error("Erreur lors de la mise à jour du score :", err);
                return res.status(500).json({ error: 'Erreur lors de la mise à jour du score' });
            }

            // Récupérer le nouveau score
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

// Route pour récupérer le score
app.get('/score', async (req, res) => {
    const pseudo = req.session.user;

    if (!pseudo) {
        return res.status(400).json({ error: 'Utilisateur non connecté' });
    }

    // Récupérer le score de l'utilisateur
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
});

// Route pour réinitialiser le score
app.post('/reset', async (req, res) => {
    const pseudo = req.session.user;

    if (!pseudo) {
        return res.status(400).json({ error: 'Utilisateur non connecté' });
    }

    // Réinitialiser le score de l'utilisateur
    db.run(
        'UPDATE utilisateurs SET score = 0 WHERE pseudo = ?',
        [pseudo],
        function (err) {
            if (err) {
                console.error("Erreur lors de la réinitialisation du score :", err);
                return res.status(500).json({ error: 'Erreur lors de la réinitialisation du score' });
            }

            res.json({ success: true });
        }
    );
});

// Route pour acheter un multiplicateur
app.post('/buy-multiplier', async (req, res) => {
    const pseudo = req.session.user;

    if (!pseudo) {
        console.log("Utilisateur non connecté"); // Log pour débogage
        return res.status(400).json({ error: 'Utilisateur non connecté' });
    }

    console.log("Utilisateur connecté :", pseudo); // Log pour débogage

    // Vérifier si l'utilisateur a assez de cookies
    db.get(
        'SELECT score FROM utilisateurs WHERE pseudo = ?',
        [pseudo],
        (err, row) => {
            if (err || !row) {
                console.log("Erreur lors de la récupération du score :", err); // Log pour débogage
                return res.status(500).json({ error: 'Erreur lors de la récupération du score' });
            }

            console.log("Score de l'utilisateur :", row.score); // Log pour débogage

            if (row.score >= 900) {
                // Déduire 900 cookies et mettre à jour le multiplicateur
                db.run(
                    'UPDATE utilisateurs SET score = score - 900, multiplier = 2 WHERE pseudo = ?',
                    [pseudo],
                    function (err) {
                        if (err) {
                            console.log("Erreur lors de la mise à jour du score :", err); // Log pour débogage
                            return res.status(500).json({ error: 'Erreur lors de la mise à jour du score' });
                        }

                        console.log("Multiplicateur acheté avec succès pour :", pseudo); // Log pour débogage
                        res.json({ success: true });
                    }
                );
            } else {
                console.log("Pas assez de cookies pour :", pseudo); // Log pour débogage
                res.json({ success: false, message: 'Pas assez de cookies' });
            }
        }
    );
});

// Route pour acheter un autoclicker
app.post('/buy-autoclicker', async (req, res) => {
    const pseudo = req.session.user;

    if (!pseudo) {
        return res.status(400).json({ error: 'Utilisateur non connecté' });
    }

    // Vérifier si l'utilisateur a assez de cookies
    db.get(
        'SELECT score FROM utilisateurs WHERE pseudo = ?',
        [pseudo],
        (err, row) => {
            if (err || !row) {
                return res.status(500).json({ error: 'Erreur lors de la récupération du score' });
            }

            if (row.score >= 5000) {
                // Déduire 5000 cookies et activer l'autoclicker
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

// Route pour récupérer les améliorations de l'utilisateur
app.get('/upgrades', async (req, res) => {
    const pseudo = req.session.user;

    if (!pseudo) {
        return res.status(400).json({ error: 'Utilisateur non connecté' });
    }

    // Récupérer les améliorations de l'utilisateur
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

// Route pour récupérer le classement des joueurs
app.get('/classement-data', async (req, res) => {
    // Récupérer tous les joueurs triés par score (du plus élevé au plus bas)
    db.all(
        'SELECT pseudo, score FROM utilisateurs ORDER BY score DESC',
        (err, rows) => {
            if (err) {
                console.error("Erreur lors de la récupération du classement :", err);
                return res.status(500).json({ error: 'Erreur lors de la récupération du classement' });
            }

            res.json({ classement: rows });
        }
    );
});

// Routes pour les pages HTML
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

// Démarrer le serveur
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});