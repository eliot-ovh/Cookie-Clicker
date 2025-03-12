// Récupérer les éléments HTML
const scoreDisplay = document.getElementById("score");
const buyMultiplierButton = document.getElementById("buy-multiplier");
const buyAutoclickerButton = document.getElementById("buy-autoclicker");

// Nom d'utilisateur (à améliorer)
const username = "player1"; 

// 🔹 Charger les données du joueur depuis l'API
async function loadPlayerData() {
    try {
        const response = await fetch(`/player/${username}`);
        const data = await response.json();
        scoreDisplay.textContent = data.cookies;

        // Désactiver le bouton d'autoclicker s'il est déjà activé
        if (data.autoclicker) {
            buyAutoclickerButton.disabled = true;
        }
    } catch (error) {
        console.error("❌ Erreur lors du chargement des données :", error);
    }
}

// 🔹 Acheter un multiplicateur
buyMultiplierButton.addEventListener("click", async () => {
    try {
        const response = await fetch("/buy-multiplier", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username })
        });
        const data = await response.json();
        if (data.success) {
            scoreDisplay.textContent = data.cookies;
            alert("Multiplicateur amélioré !");
        } else {
            alert("Pas assez de cookies !");
        }
    } catch (error) {
        console.error("❌ Erreur lors de l'achat du multiplicateur :", error);
    }
});

// 🔹 Acheter un autoclicker
buyAutoclickerButton.addEventListener("click", async () => {
    try {
        const response = await fetch("/buy-autoclicker", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username })
        });
        const data = await response.json();
        if (data.success) {
            scoreDisplay.textContent = data.cookies;
            buyAutoclickerButton.disabled = true;
            alert("Autoclicker activé !");
        } else {
            alert("Pas assez de cookies !");
        }
    } catch (error) {
        console.error("❌ Erreur lors de l'achat de l'autoclicker :", error);
    }
});

// Charger les données au démarrage
loadPlayerData();
