require('dotenv').config();
const tmi = require('tmi.js');
const { getAppAccessToken, getUserId, getStreamInfo } = require('./lib/helix');

// Minimal checks
const required = ['TWITCH_USERNAME', 'TWITCH_CHANNEL', 'TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[config] Missing ${key} in .env`);
    process.exit(1);
  }
}

const BOT_USERNAME = process.env.TWITCH_USERNAME;
const CHANNEL = process.env.TWITCH_CHANNEL;
const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

// Build client options. If no TWITCH_CHAT_OAUTH is provided, connect anonymously (read-only)
const clientOpts = {
  options: { debug: true },
  connection: { reconnect: true, secure: true },
  channels: [CHANNEL]
};

if (process.env.TWITCH_CHAT_OAUTH) {
  clientOpts.identity = {
    username: BOT_USERNAME,
    password: process.env.TWITCH_CHAT_OAUTH,
  };
}

// Create tmi client
const client = new tmi.Client(clientOpts);

function isAuthenticated() {
  const id = client.opts.identity;
  return !!(id && id.username && id.password && id.password.trim().length > 0);
}

function sendMessage(channel, content) {
  if (!isAuthenticated()) {
    console.log('[chat] Ignoré (non authentifié):', content);
    return Promise.resolve(false);
  }
  return client.say(channel, content).then(() => true).catch(err => {
    console.error('[chat] Envoi échoué', err?.message || err);
    return false;
  });
}

client.on('message', async (channel, tags, message, self) => {
  if (self) return;
  const msg = message.trim();

  // Simple commands
  if (msg === '!help') {
    if (isAuthenticated()) {
      sendMessage(channel, 'Commandes: !ping, !uptime');
    }
    return;
  }

  if (msg === '!ping') {
    if (isAuthenticated()) sendMessage(channel, 'pong');
    return;
  }

  if (msg === '!socials') {
    try {
      const token = await getAppAccessToken(CLIENT_ID, CLIENT_SECRET);
      const userId = await getUserId(token, CLIENT_ID, CHANNEL.replace(/^#/, ''));
      const stream = await getStreamInfo(token, CLIENT_ID, userId);
      if (stream) {
        const started = new Date(stream.started_at);
        const diffMs = Date.now() - started.getTime();
        const mins = Math.floor(diffMs / 60000);
        const hours = Math.floor(mins / 60);
        const rem = mins % 60;
        const text = hours > 0 ? `${hours}h${rem}m` : `${rem}m`;
        if (isAuthenticated()) sendMessage(channel, `Le live est en cours depuis ${text}.`);
      } else {
        if (isAuthenticated()) sendMessage(channel, 'Le live est hors-ligne.');
      }
    } catch (err) {
      console.error('[uptime] error', err?.response?.data || err.message);
    }
    return;
  }
});

client.on('connected', (addr, port) => {
  console.log(`[chat] Connecté à ${addr}:${port} - canal #${CHANNEL}`);
  if (!isAuthenticated()) {
    console.log('[chat] Mode lecture seule (anonyme). Pour parler, ajoutez TWITCH_CHAT_OAUTH dans .env');
  }
});

client.connect().catch(err => {
  console.error('[chat] connection error', err);
});

// Capture globale des promesses rejetées pour éviter l'arrêt brutal et diagnostiquer
process.on('unhandledRejection', (reason) => {
  console.error('[global] Rejet de promesse non géré:', reason);
});
