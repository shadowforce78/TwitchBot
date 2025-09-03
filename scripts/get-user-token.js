#!/usr/bin/env node
// Obtenir un token utilisateur Twitch (PKCE) adapté au chat IRC (chat:read chat:edit)
const crypto = require('crypto');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
// `open` est ESM-only; utilisons une importation dynamique compatible CJS
async function openInBrowser(url) {
  try {
    const mod = await import('open');
    const opener = mod.default || mod;
    await opener(url);
  } catch (e) {
    console.log('Ouvre ce lien dans ton navigateur si nécessaire:', url);
  }
}
require('dotenv').config();

const CLIENT_ID = process.env.TWITCH_CLIENT_ID || process.argv[2];
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET; // optionnel si PKCE non accepté
const REDIRECT_URI = process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/callback';
const SCOPES = ['chat:read', 'chat:edit'];

if (!CLIENT_ID) {
  console.error('TWITCH_CLIENT_ID manquant. Configurez-le dans .env ou passez-le en argument.');
  process.exit(1);
}

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
const verifier = b64url(crypto.randomBytes(64));
const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());

const authorizeUrl = new URL('https://id.twitch.tv/oauth2/authorize');
authorizeUrl.searchParams.set('client_id', CLIENT_ID);
authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authorizeUrl.searchParams.set('response_type', 'code');
authorizeUrl.searchParams.set('scope', SCOPES.join(' '));
authorizeUrl.searchParams.set('code_challenge', challenge);
authorizeUrl.searchParams.set('code_challenge_method', 'S256');
authorizeUrl.searchParams.set('force_verify', 'true');

const port = Number(new URL(REDIRECT_URI).port || 3000);

function updateEnv(values) {
  const envPath = path.resolve(process.cwd(), '.env');
  let content = '';
  try { content = fs.readFileSync(envPath, 'utf8'); } catch {}
  for (const [key, val] of Object.entries(values)) {
    const line = `${key}=${val}`;
    if (content.match(new RegExp(`^${key}=`, 'm'))) {
      content = content.replace(new RegExp(`^${key}=.*$`, 'm'), line);
    } else {
      content += (content.endsWith('\n') ? '' : '\n') + line + '\n';
    }
  }
  fs.writeFileSync(envPath, content, 'utf8');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname !== new URL(REDIRECT_URI).pathname) {
    res.writeHead(404).end('Not found');
    return;
  }
  const code = url.searchParams.get('code');
  const err = url.searchParams.get('error');
  if (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Erreur OAuth: ${err}`);
    console.error('Erreur OAuth:', err);
    server.close();
    return;
  }
  if (!code) {
    res.writeHead(400).end('Code manquant');
    return;
  }
  try {
    const params = {
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    };
    if (CLIENT_SECRET) {
      params.client_secret = CLIENT_SECRET;
    }
    const tokenResp = await axios.post('https://id.twitch.tv/oauth2/token', null, { params });
    const accessToken = tokenResp.data.access_token;
    const refreshToken = tokenResp.data.refresh_token;
    updateEnv({
      TWITCH_OAUTH_TOKEN: accessToken.startsWith('oauth:') ? accessToken : `oauth:${accessToken}`,
      ...(refreshToken ? { TWITCH_REFRESH_TOKEN: refreshToken } : {}),
    });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<h3>Token(s) ajouté(s) à .env ✅</h3>Vous pouvez fermer cette fenêtre.');
    console.log('Access Token écrit: TWITCH_OAUTH_TOKEN.');
    if (refreshToken) console.log('Refresh Token écrit: TWITCH_REFRESH_TOKEN.');
  } catch (e) {
    console.error('Échec échange code->token:', e.response?.data || e.message);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Erreur lors de l\'échange de code.');
  } finally {
    setTimeout(() => server.close(), 250);
  }
});

server.listen(port, async () => {
  console.log(`Serveur OAuth sur http://localhost:${port}`);
  console.log('Ouverture du navigateur pour autoriser l\'application...');
  await openInBrowser(authorizeUrl.toString());
});
