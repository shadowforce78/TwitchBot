#!/usr/bin/env node
// Échange TWITCH_REFRESH_TOKEN -> nouvel access_token et refresh_token
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.TWITCH_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('Manque TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET ou TWITCH_REFRESH_TOKEN dans .env');
  process.exit(1);
}

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

(async () => {
  try {
    const resp = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: REFRESH_TOKEN,
      },
    });
    const access = resp.data.access_token;
    const refresh = resp.data.refresh_token || REFRESH_TOKEN;
    updateEnv({
      TWITCH_OAUTH_TOKEN: access.startsWith('oauth:') ? access : `oauth:${access}`,
      TWITCH_REFRESH_TOKEN: refresh,
    });
    console.log('✔ Token actualisé. Écrit dans .env (TWITCH_OAUTH_TOKEN + TWITCH_REFRESH_TOKEN).');
  } catch (e) {
    console.error('Échec refresh:', e.response?.data || e.message);
    process.exit(1);
  }
})();
