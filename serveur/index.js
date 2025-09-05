// Serveur Express minimal pour communiquer avec le bot Twitch
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { join } = require('path');

const PORT = process.env.WEB_PORT || 3003;

const app = express();
app.use(bodyParser.json());

// Import du bot (on suppose qu'il exporte une fonction sendMessage)
let bot;
try {
	bot = require('../src/botInstance');
} catch (err) {
	console.warn('[serveur] Impossible de charger le botInstance:', err.message);
}


app.get('/', (req, res) => {
	res.sendFile(join(__dirname, 'public', 'index.html'));
});


module.exports = {
	start: () => app.listen(PORT, () => {
		console.log(`[serveur] Serveur web démarré sur http://localhost:${PORT}`);
	})
};