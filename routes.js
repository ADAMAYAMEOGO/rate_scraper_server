const express = require('express');
const db = require('./db');
const { exec } = require('child_process');
const path = require('path');

const router = express.Router();

// Route GET : Récupérer les taux de change stockés
router.get('/taux', (req, res) => {
    const sql = "SELECT * FROM taux ORDER BY date_scraping DESC LIMIT 10";
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: "Erreur serveur" });
        }
        res.json(results);
    });
});

// Route POST : Rafraîchir les taux en exécutant scraper.py
router.post('/taux/refresh', (req, res) => {

    // Vérification de la clé API
    const apiKey = req.headers['x-api-key']; 
    const validApiKey = process.env.API_KEY;

    if (!apiKey || apiKey !== validApiKey) {
        return res.status(403).json({ error: "Accès interdit : clé API invalide" });
    }

    // Construire le chemin absolu du script Python
    const scraperPath = path.join(__dirname, '../rate_scraper/scraper.py');
    
    console.log(`Exécution de : python3 ${scraperPath}`);
    
    exec(`python3 ${scraperPath}`, (error, stdout, stderr) => {
        console.log("stdout:", stdout);
        console.log("stderr:", stderr);

        if (error) {
            console.error(`Erreur d'exécution: ${error.message}`);
            return res.status(500).json({ error: "Erreur lors du rafraîchissement des taux", details: error.message });
        }

        if (stderr) {
            console.error(`Erreur dans le script : ${stderr}`);
        }

        // Vérifier si les taux ont bien été mis à jour
        console.log("Vérification des données insérées...");
        const sql = "SELECT COUNT(*) AS count FROM taux WHERE date_scraping >= NOW() - INTERVAL 5 MINUTE";

        db.query(sql, (err, results) => {
            if (err) {
                console.error("Erreur SQL lors de la vérification des taux:", err.message);
                return res.status(500).json({ error: "Erreur serveur lors de la vérification des taux" });
            }

            //Récuperer le nombre de taux enregistrer
            const count = results[0].count;
            if (count > 0) {
                console.log(`${count} nouveaux taux enregistrés`);
                return res.json({ message: "Rafraîchissement des taux réussi", output: stdout });
            } else {
                console.warn("Aucun nouveau taux ajouté !");
                return res.status(500).json({ error: "Le script s'est exécuté, mais aucun taux n'a été ajouté." });
            }
        });
    });
});

module.exports = router;
