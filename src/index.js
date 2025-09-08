require("dotenv").config();
const tmi = require("tmi.js");
const path = require("path");
const { loadCommands } = require("./commands/_loader");
const { start } = require("../serveur"); // Démarre le serveur web

// Minimal checks
const required = [
    "TWITCH_USERNAME",
    "TWITCH_CHANNEL",
    "TWITCH_CLIENT_ID",
    "TWITCH_CLIENT_SECRET",
];
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
const CHANNEL_LOGIN = CHANNEL.replace(/^#/, "");
const CHAT_REFRESH = process.env.TWITCH_CHAT_REFRESH;
const { refreshChatToken } = require('./lib/helix');

// Build client options. If no TWITCH_CHAT_OAUTH is provided, connect anonymously (read-only)
const clientOpts = {
    options: { debug: true },
    connection: { reconnect: true, secure: true },
    channels: [CHANNEL],
};

async function ensureValidToken() {
    if (!process.env.TWITCH_CHAT_OAUTH && CHAT_REFRESH) {
        console.log('[auth] Aucun token chat, tentative de refresh...');
        try {
            const { access_token, refresh_token } = await refreshChatToken(CLIENT_ID, CLIENT_SECRET, CHAT_REFRESH);
            const chatOAuth = `oauth:${access_token}`;
            clientOpts.identity = {
                username: BOT_USERNAME,
                password: chatOAuth,
            };
            // Optionnel: mettre à jour le .env automatiquement (sinon afficher à l’utilisateur)
            console.log('[auth] Nouveau token chat généré, ajoutez dans .env :');
            console.log('TWITCH_CHAT_OAUTH=' + chatOAuth);
            if (refresh_token && refresh_token !== CHAT_REFRESH) {
                console.log('TWITCH_CHAT_REFRESH=' + refresh_token);
            }
        } catch (err) {
            console.error('[auth] Refresh token échoué', err?.response?.data || err.message);
        }
    } else if (process.env.TWITCH_CHAT_OAUTH) {
        clientOpts.identity = {
            username: BOT_USERNAME,
            password: process.env.TWITCH_CHAT_OAUTH,
        };
    }
}

// Appel du refresh avant création du client
let client;
async function startBot() {
    await ensureValidToken();
    client = new tmi.Client(clientOpts);

    function isAuthenticated() {
        const id = client.opts.identity;
        return !!(id && id.username && id.password && id.password.trim().length > 0);
    }

    function sendMessage(channel, content) {
        if (!isAuthenticated()) {
            console.log('[chat] Ignoré (non authentifié):', content);
            return Promise.resolve(false);
        }
        return client
            .say(channel, content)
            .then(() => true)
            .catch((err) => {
                console.error('[chat] Envoi échoué', err?.message || err);
                return false;
            });
    }

    // Lancement du serveur web
    start();

    // Chargement dynamique des commandes
    const commandsDir = path.join(__dirname, "commands");
    const registry = loadCommands(commandsDir);
    console.log(
        "[commands] Chargées:",
        registry.map((c) => `${c.name}${c.enabled === false ? ':off' : ''}`).join(", ") || "(aucune)"
    );

    client.on("message", async (channel, tags, message, self) => {
        if (self) return;
        const msg = message.trim();
        if (!msg.startsWith("!")) return;
        const [rawName, ...args] = msg.slice(1).split(/\s+/);
        const name = rawName.toLowerCase();
    const cmd = registry.find((c) => c.name === name);
    if (!cmd) return; // commande inconnue, silence
    if (cmd.enabled === false) return; // désactivée
        if (!isAuthenticated()) return; // en lecture seule, ignore tout
        const isBroadcaster = tags.badges && (tags.badges.broadcaster === '1' || tags['user-id'] === tags['room-id']);
        const isMod = isBroadcaster || tags.mod === true || tags.mod === '1';
        const isVip = !!(tags.badges && tags.badges.vip === '1');
        const ctx = {
            channel,
            user: tags["display-name"] || tags.username,
            args,
            raw: msg,
            client,
            reply: (text) => sendMessage(channel, text),
            registry,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            channelLogin: CHANNEL_LOGIN,
            badges: tags.badges || {},
            isBroadcaster,
            isMod,
            isVip,
            userId: tags['user-id']
        };
        try {
            await cmd.execute(ctx);
        } catch (err) {
            console.error(`[cmd:${cmd.name}]`, err.message || err);
            ctx.reply("Erreur commande.");
        }
    });

    client.on("connected", (addr, port) => {
        console.log(`[chat] Connecté à ${addr}:${port} - canal #${CHANNEL}`);
        if (!isAuthenticated()) {
            console.log(
                "[chat] Mode lecture seule (anonyme). Pour parler, ajoutez TWITCH_CHAT_OAUTH dans .env"
            );
        }
        // Enregistrer l'instance pour le panneau
        try {
            const { registerBot } = require('./botInstance');
            registerBot(client, CHANNEL, registry);
        } catch (e) {
            console.warn('[botInstance] Enregistrement échoué:', e.message);
        }
    });

    client.connect().catch((err) => {
        console.error("[chat] connection error", err);
    });

    // Capture globale des promesses rejetées pour éviter l'arrêt brutal et diagnostiquer
    process.on("unhandledRejection", (reason) => {
        console.error("[global] Rejet de promesse non géré:", reason);
    });
}

startBot().catch(err => {
    console.error('[auth] Erreur initialisation bot', err);
});

