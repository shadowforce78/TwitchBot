// Serveur Express avec OAuth Twitch + panneau de gestion
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const axios = require('axios');
const { join } = require('path');

const PORT = process.env.WEB_PORT || 3003;
const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const CHANNEL_LOGIN = (process.env.TWITCH_CHANNEL || '').replace(/^#/, '');
const BASE_URL = process.env.WEB_BASE_URL || `http://localhost:${PORT}`;
// Whitelist de logins autorisés même sans statut mod (séparés par virgule ou espaces)
const WHITELIST = (process.env.PANEL_WHITELIST || '')
	.toLowerCase()
	.split(/[\s,]+/)
	.filter(Boolean);
// const OAUTH_REDIRECT = `${BASE_URL}/oauth/callback`;
const OAUTH_REDIRECT = `http://localhost:3003/oauth/callback`

const app = express();
app.use(bodyParser.json());
app.use(session({
	secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
	resave: false,
	saveUninitialized: false,
	cookie: { httpOnly: true, sameSite: 'lax' }
}));

// Static
app.use('/css', express.static(join(__dirname, 'public', 'css')));
app.use('/js', express.static(join(__dirname, 'public', 'js')));
app.use('/images', express.static(join(__dirname, 'public', 'assets', 'img')));
app.use('/icons', express.static(join(__dirname, 'public', 'assets', 'ico')));

// Index
app.get('/', (req, res) => {
	res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Login route -> redirection OAuth Twitch
app.get('/login', (req, res) => {
	const scope = ['moderator:read:chatters', 'user:read:email'];
	const authorizeUrl = new URL('https://id.twitch.tv/oauth2/authorize');
	authorizeUrl.searchParams.set('client_id', CLIENT_ID);
	authorizeUrl.searchParams.set('redirect_uri', OAUTH_REDIRECT);
	authorizeUrl.searchParams.set('response_type', 'code');
	authorizeUrl.searchParams.set('scope', scope.join(' '));
	res.redirect(authorizeUrl.toString());
});

// Callback OAuth
app.get('/oauth/callback', async (req, res) => {
	const code = req.query.code;
	if (!code) return res.status(400).send('Code OAuth manquant');
	try {
		const params = new URLSearchParams({
			client_id: CLIENT_ID,
			client_secret: CLIENT_SECRET,
			code,
			grant_type: 'authorization_code',
			redirect_uri: OAUTH_REDIRECT
		});
		const { data } = await axios.post('https://id.twitch.tv/oauth2/token', params);
		const accessToken = data.access_token;
		// Récupérer infos utilisateur
		const userResp = await axios.get('https://api.twitch.tv/helix/users', {
			headers: { 'Authorization': `Bearer ${accessToken}`, 'Client-Id': CLIENT_ID }
		});
		const user = userResp.data.data?.[0];
		if (!user) return res.status(500).send('Utilisateur introuvable');

		// Vérifier modération: nécessite liste des modérateurs (alternative: Get Chatters + badges via autre endpoint)
		let isAuthorized = false;
		try {
			const modsResp = await axios.get('https://api.twitch.tv/helix/moderation/moderators', {
				headers: { 'Authorization': `Bearer ${accessToken}`, 'Client-Id': CLIENT_ID },
				params: { broadcaster_id: user.id, user_id: user.id }
			});
			// Ci-dessus ne fonctionne que si l'utilisateur est mod sur sa propre chaîne (toujours vrai). On veut vérifier qu'il est mod sur CHANNEL_LOGIN.
		} catch (_) {}

		// Approche: récupérer broadcaster id du channel cible puis appeler /moderation/moderators?broadcaster_id=... et comparer user.id
		try {
			const channelUserResp = await axios.get('https://api.twitch.tv/helix/users', {
				headers: { 'Authorization': `Bearer ${accessToken}`, 'Client-Id': CLIENT_ID },
				params: { login: CHANNEL_LOGIN }
			});
			const channelUser = channelUserResp.data.data?.[0];
			if (channelUser) {
				// Broadcaster lui-même a plein accès
				if (user.id === channelUser.id) {
					isAuthorized = true;
				}
			}
		} catch (err) {
			console.warn('[oauth] Vérification d\'accès échouée', err?.response?.data || err.message);
		}

		// Application whitelist
		const loginLower = user.login.toLowerCase();
		const isWhitelisted = WHITELIST.includes(loginLower);
		if (isWhitelisted) {
			console.log(`[oauth] Accès autorisé par whitelist pour ${user.login}`);
		}
		req.session.user = {
			id: user.id,
			login: user.login,
			displayName: user.display_name,
			profileImage: user.profile_image_url,
			accessToken,
			isAuthorized: isAuthorized || isWhitelisted,
			isWhitelisted
		};

		if (!(isAuthorized || isWhitelisted)) {
			return res.redirect('/no-access');
		}
		res.redirect('/panel');
	} catch (err) {
		console.error('[oauth] Erreur callback', err?.response?.data || err.message);
		res.status(500).send('Erreur OAuth');
	}
});

app.get('/no-access', (req, res) => {
	res.send('<h1>Accès refusé</h1><p>Vous devez être modérateur de la chaîne pour accéder au panneau.</p><a href="/">Retour</a>');
});

// Middleware auth panel
function requireAccess(req, res, next) {
	if (!req.session.user) return res.redirect('/');
	if (!(req.session.user.isWhitelisted)) return res.redirect('/no-access');
	next();
}

app.get('/panel', requireAccess, (req, res) => {
	res.sendFile(join(__dirname, 'public', 'panel.html'));
});

app.get('/api/me', (req, res) => {
	if (!req.session.user) return res.json({ loggedIn: false });
	const { id, login, displayName, profileImage, isAuthorized, isWhitelisted } = req.session.user;
	res.json({ loggedIn: true, id, login, displayName, profileImage, isAuthorized, isWhitelisted });
});

// Endpoint pour envoyer un message via le bot (placeholder - nécessite intégration avec instance du bot)
app.post('/api/chat/send', async (req, res) => {
	if (!req.session.user || !req.session.user.isAuthorized) return res.status(403).json({ ok: false, error: 'forbidden' });
	const text = (req.body && req.body.message || '').trim();
	if (!text) return res.json({ ok: false, error: 'empty' });
	try {
		const { sendMessage } = require('../src/botInstance');
		const r = await sendMessage(text);
		return res.json(r);
	} catch (err) {
		console.error('[panel] send error', err.message || err);
		res.status(500).json({ ok: false, error: 'internal' });
	}
});

app.post('/logout', (req, res) => {
	req.session.destroy(() => {
		res.redirect('/');
	});
});

// ==== API commandes ====
app.get('/api/commands', (req, res) => {
	if (!req.session.user || !(req.session.user.isAuthorized || req.session.user.isWhitelisted)) return res.status(403).json({ error: 'forbidden' });
	try {
		const { getRegistry } = require('../src/botInstance');
		const reg = getRegistry() || [];
		res.json(reg.map(c => ({ name: c.name, enabled: c.enabled !== false, description: c.description || '' })));
	} catch (e) {
		res.status(500).json({ error: 'internal' });
	}
});

app.post('/api/commands/:name/toggle', (req, res) => {
	if (!req.session.user || !(req.session.user.isAuthorized || req.session.user.isWhitelisted)) return res.status(403).json({ error: 'forbidden' });
	try {
		const { getRegistry } = require('../src/botInstance');
		const reg = getRegistry() || [];
		const cmd = reg.find(c => c.name === req.params.name);
		if (!cmd) return res.status(404).json({ error: 'not_found' });
		if (cmd.name === 'command') return res.status(400).json({ error: 'protected' });
		cmd.enabled = !(cmd.enabled !== false);
		try {
			const { saveState } = require('../src/storage/commandState');
			saveState(reg);
		} catch (e) {
			console.warn('[commands][state] panel save error:', e.message);
		}
		res.json({ name: cmd.name, enabled: cmd.enabled });
	} catch (e) {
		res.status(500).json({ error: 'internal' });
	}
});

module.exports = {
	start: () => app.listen(PORT, () => {
		console.log(`[serveur] Serveur web démarré sur ${BASE_URL}`);
		console.log(`[oauth] Redirect URI attendu: ${OAUTH_REDIRECT}`);
	})
};
