#!/usr/bin/env node
// Script d'obtention d'un token OAuth utilisateur pour le chat Twitch (scopes chat:read chat:edit)
// Utilisation: npm run auth
// Résultat: affiche une valeur à mettre dans .env => TWITCH_CHAT_OAUTH=oauth:xxxxx

require('dotenv').config();
const express = require('express');
const axios = require('axios');

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const REDIRECT_URI = process.env.TWITCH_REDIRECT_URI || 'http://localhost:3003/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('[auth] TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET sont requis dans .env');
  process.exit(1);
}

const app = express();

app.get('/', (req, res) => {
  const scope = ['chat:read','chat:edit', 'channel:bot'];
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope.join(' '));
  res.send(`
    <h1>OAuth Chat Twitch</h1>
    <p><a href="${url.toString()}">Se connecter avec Twitch</a></p>
    <p>Après connexion, vous recevrez un token à copier dans votre fichier <code>.env</code>.</p>
  `);
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
    const chatOAuth = `oauth:${data.access_token}`;
    const refresh = data.refresh_token;
    console.log('\n[auth] Token récupéré. Ajoutez dans .env :');
    console.log('TWITCH_CHAT_OAUTH=' + chatOAuth);
    if (refresh) {
      console.log('TWITCH_CHAT_REFRESH=' + refresh);
    }
    console.log('\n');
    res.send(`
      <h2>Succès ✔</h2>
      <p>Ajoutez dans votre fichier .env :</p>
      <pre>TWITCH_CHAT_OAUTH=${chatOAuth}
${refresh ? `TWITCH_CHAT_REFRESH=${refresh}` : ''}</pre>
      <p>Ensuite redémarrez le bot: <code>npm start</code></p>
      <p>Le refresh_token permet de régénérer automatiquement le token chat sans repasser par la connexion Twitch.</p>
    `);
  } catch (err) {
    console.error('[auth] Erreur OAuth', err?.response?.data || err.message);
    res.status(500).send('Erreur OAuth');
  }
});

const port = Number(new URL(REDIRECT_URI).port) || 3003;
app.listen(port, () => {
  console.log(`[auth] Serveur OAuth sur ${REDIRECT_URI}`);
  console.log('[auth] Ouvrez cette URL dans votre navigateur si cela ne se lance pas automatiquement: ' + REDIRECT_URI.replace('/callback','/'));
});
