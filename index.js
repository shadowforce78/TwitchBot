// Twitch IRC via WebSocket (ws) — nécessite un token utilisateur (pas un App Token)
const WebSocket = require('ws');
require('dotenv').config();

// Variables d'environnement requises
let username = process.env.TWITCH_USERNAME; // nom d'utilisateur du compte Twitch du bot
let channel = process.env.TWITCH_CHANNEL;   // chaîne à rejoindre (sans #)
let oauthToken = process.env.TWITCH_OAUTH_TOKEN; // token utilisateur avec scopes chat:read et chat:edit

// Validation des variables
const looksLikePlaceholder = (val) => !val || [/^VotreNomDeBot$/i, /^nomdelachaine$/i, /x{6,}/i].some((re) => re.test(val));
if (looksLikePlaceholder(username) || looksLikePlaceholder(channel) || looksLikePlaceholder(oauthToken)) {
    console.error("Configuration incomplète. Ouvrez .env et renseignez TWITCH_USERNAME, TWITCH_CHANNEL et TWITCH_OAUTH_TOKEN réels.\nAstuce: générez un token sur https://twitchapps.com/tmi/ (format oauth:xxxx).\nEnsuite relancez: npm start");
    process.exit(1);
}

// Normalise valeurs (minuscule recommandé par IRC) et format du PASS
username = username.trim().toLowerCase();
channel = channel.trim().toLowerCase();
if (!oauthToken.startsWith('oauth:')) {
    oauthToken = `oauth:${oauthToken}`;
}

const socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
let joined = false;

socket.on('open', () => {
    // Authentification IRC: PASS + NICK + JOIN
    socket.send(`PASS ${oauthToken}`);
    socket.send(`NICK ${username}`);
    // Demander les capacités pour tags/commands/membership (utile pour debug et états)
    socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
    socket.send(`JOIN #${channel}`);
    console.log(`Connecté en tant que ${username}, rejoint #${channel}`);
});

socket.on('message', (data) => {
    const msg = data.toString();
    // Affiche brut pour debug
    console.log(msg.trim());

    // Notifies login unsuccessful => souvent token invalide ou username ≠ propriétaire du token
    if (msg.includes('Login unsuccessful')) {
        console.error('Login Twitch échoué. Vérifie que TWITCH_USERNAME correspond au compte lié au token, et que le token est valide.');
    }

    // Répond aux PING pour garder la connexion vivante
    if (msg.startsWith('PING')) {
        socket.send(msg.replace('PING', 'PONG'));
        return;
    }

    // Détecte la fin du JOIN (End of /NAMES list) pour marquer la dispo
    const endNames = msg.match(/^:.* 366 [^ ]+ #(\w+) :End of \/NAMES list/);
    if (endNames) {
        joined = true;
        // Message de test (une seule fois)
        safeSendMessage(endNames[1], 'Bot connecté ✅');
    }

    // Détecte les messages chat et répond à !ping
    const match = msg.match(/^:([^!]+)!.* PRIVMSG #(\w+) :(.*)$/);
    if (match) {
        const [_, author, ch, text] = match;
        if (text.trim().toLowerCase() === '!ping') {
            safeSendMessage(ch, `Pong! (salut ${author})`);
        }
    }
});

socket.on('error', (err) => {
    console.error('Erreur WebSocket:', err.message || err);
});

socket.on('close', (code, reason) => {
    console.warn(`Connexion fermée (${code}) ${reason?.toString?.() || ''}`);
});

function safeSendMessage(ch, text) {
    if (socket.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket non ouvert, message non envoyé.');
        return;
    }
    const line = `PRIVMSG #${ch} :${text}`;
    console.log('>>', line);
    socket.send(line);
}