// Serveur Express minimal pour communiquer avec le bot Twitch
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

const PORT = process.env.WEB_PORT || 3002;

const app = express();
app.use(bodyParser.json());

// Import du bot (on suppose qu'il exporte une fonction sendMessage)
let bot;
try {
	bot = require('../src/botInstance');
} catch (err) {
	console.warn('[serveur] Impossible de charger le botInstance:', err.message);
}

app.post('/say', async (req, res) => {
	if (!bot || typeof bot.sendMessage !== 'function') {
		return res.status(500).json({ error: 'Bot non disponible' });
	}
	const { message } = req.body;
	if (!message || typeof message !== 'string') {
		return res.status(400).json({ error: 'Message manquant ou invalide' });
	}
	try {
		await bot.sendMessage(message);
		res.json({ ok: true });
	} catch (err) {
		res.status(500).json({ error: err.message || err });
	}
});

app.get('/', (req, res) => {
	res.send('<h1>Serveur Web TwitchBot</h1><p>POST /say { message }</p>');
});




module.exports = {
	start: () => app.listen(PORT, () => {
		console.log(`[serveur] Serveur web démarré sur http://localhost:${PORT}`);
	})
};