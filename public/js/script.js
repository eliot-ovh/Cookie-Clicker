// Récupérer les éléments HTML
const cookieButton = document.getElementById("cookie");
const cookieCount = document.getElementById("count");
const resetButton = document.getElementById("reset");

// Nom d'utilisateur (temporaire, peut être amélioré)
const username = "player1"; 

// 🔹 Charger le score depuis l'API au démarrage
async function loadScore() {
    try {
        const response = await fetch(`/score/${username}`);
        const data = await response.json();
        cookieCount.textContent = data.cookies;
    } catch (error) {
        console.error("❌ Erreur lors du chargement du score :", error);
    }
}

// 🔹 Mettre à jour le score lors d'un clic sur le cookie
cookieButton.addEventListener("click", async () => {
    try {
        const response = await fetch("/click", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username })
        });
        const data = await response.json();
        cookieCount.textContent = data.cookies;
    } catch (error) {
        console.error("❌ Erreur lors de la mise à jour du score :", error);
    }
});

// 🔹 Réinitialiser le score
resetButton.addEventListener("click", async () => {
    const confirmReset = confirm("Êtes-vous sûr de vouloir réinitialiser votre score ?");
    if (!confirmReset) return;

    try {
        const response = await fetch("/reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username })
        });
        const data = await response.json();
        cookieCount.textContent = data.cookies;
        alert("Score réinitialisé !");
    } catch (error) {
        console.error("❌ Erreur lors de la réinitialisation du score :", error);
    }
});

// Charger le score au démarrage
loadScore();
