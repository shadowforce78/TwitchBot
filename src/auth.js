require('dotenv').config();
const express = require('express');
const axios = require('axios');

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const REDIRECT_URI = process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET requis dans .env');
  process.exit(1);
}

// Petit helper pour obtenir un token OAuth "chat" (user access token) et le formater pour tmi.js
// Ajoutez TWITCH_REDIRECT_URI dans .env si vous voulez un autre port/chemin.

const app = express();

app.get('/', (req, res) => {
  const scope = [
    'chat:read',
    'chat:edit'
  ];
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope.join(' '));
  res.send(`<a href="${url.toString()}">Se connecter avec Twitch</a>`);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Code manquant');
  try {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    });
    const { data } = await axios.post('https://id.twitch.tv/oauth2/token', params);
    // tmi.js demande "oauth:<token>"
    const chatOAuth = `oauth:${data.access_token}`;
    res.send(`<p>Copiez cette valeur dans .env en TWITCH_CHAT_OAUTH=</p><pre>${chatOAuth}</pre>`);
  } catch (err) {
    console.error('OAuth error', err?.response?.data || err.message);
    res.status(500).send('Erreur OAuth');
  }
});

const port = Number(new URL(REDIRECT_URI).port) || 3000;
app.listen(port, () => console.log(`Serveur OAuth sur http://localhost:${port}`));
