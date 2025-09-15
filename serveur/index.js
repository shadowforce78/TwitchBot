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
const OAUTH_REDIRECT = `${BASE_URL}/oauth/callback`;

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
		} catch (_) { }

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
		console.log(`[oauth] Vérification accès pour ${user.login}:`);
		console.log(`[oauth] - isAuthorized (broadcaster): ${isAuthorized}`);
		console.log(`[oauth] - isWhitelisted: ${isWhitelisted}`);
		console.log(`[oauth] - WHITELIST:`, WHITELIST);
		console.log(`[oauth] - CHANNEL_LOGIN:`, CHANNEL_LOGIN);
		
		if (isWhitelisted) {
			console.log(`[oauth] Accès autorisé par whitelist pour ${user.login}`);
		}
		if (isAuthorized) {
			console.log(`[oauth] Accès autorisé comme broadcaster pour ${user.login}`);
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
	if (!(req.session.user.isAuthorized || req.session.user.isWhitelisted)) return res.redirect('/no-access');
	next();
}

app.get('/panel', requireAccess, (req, res) => {
	res.sendFile(join(__dirname, 'public', 'panel.html'));
});

app.get('/api/me', (req, res) => {
	if (!req.session.user) return res.json({ loggedIn: false });
	const { id, login, displayName, profileImage, isAuthorized, isWhitelisted } = req.session.user;
	console.log(`[api/me] User: ${login}, isAuthorized: ${isAuthorized}, isWhitelisted: ${isWhitelisted}`);
	res.json({ loggedIn: true, id, login, displayName, profileImage, isAuthorized, isWhitelisted, isModerator: isAuthorized || isWhitelisted });
});

// Route de debug pour voir le statut d'authentification
app.get('/api/debug-auth', (req, res) => {
	const authCheck = req.session.user ? (req.session.user.isAuthorized || req.session.user.isWhitelisted) : false;
	res.json({
		sessionExists: !!req.session.user,
		user: req.session.user ? {
			login: req.session.user.login,
			isAuthorized: req.session.user.isAuthorized,
			isWhitelisted: req.session.user.isWhitelisted,
			passesAuthCheck: authCheck
		} : null,
		whitelist: WHITELIST,
		channelLogin: CHANNEL_LOGIN
	});
});

// Route temporaire pour forcer l'ajout à la whitelist (à supprimer en production)
app.get('/api/force-whitelist', (req, res) => {
	if (req.session.user) {
		req.session.user.isWhitelisted = true;
		req.session.user.isAuthorized = true;
		res.json({ success: true, message: `${req.session.user.login} ajouté à la whitelist temporairement` });
	} else {
		res.status(401).json({ error: 'Not logged in' });
	}
});

// Endpoint pour envoyer un message via le bot (placeholder - nécessite intégration avec instance du bot)
app.post('/api/chat/send', async (req, res) => {
	if (!req.session.user || !(req.session.user.isAuthorized || req.session.user.isWhitelisted)) return res.status(403).json({ ok: false, error: 'forbidden' });
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
		const { loadCommands } = require('../src/commands/_loader');
		const path = require('path');
		const commands = loadCommands(path.join(__dirname, '../src/commands'));

		// Charger l'état des commandes depuis le storage
		try {
			const { loadState } = require('../src/storage/commandState');
			const state = loadState();
			commands.forEach(cmd => {
				if (state.disabled.includes(cmd.name)) {
					cmd.enabled = false;
				}
			});
		} catch (e) {
			console.warn('[commands][state] load error:', e.message);
		}

		// On renvoie toutes les infos nécessaires pour le panel
		res.json(commands.map(cmd => ({
			name: cmd.name,
			description: cmd.description || '',
			type: cmd.type || 'basic',
			content: cmd.content || '',
			enabled: cmd.enabled !== false,
			showInHelp: cmd.showInHelp !== false
		})));
	} catch (e) {
		console.error('[api] Error loading commands:', e);
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

// Route pour modifier le contenu d'une commande
app.put('/api/commands/:name', (req, res) => {
	const userInfo = req.session.user ? `${req.session.user.login} (auth:${req.session.user.isAuthorized}, whitelist:${req.session.user.isWhitelisted})` : 'none';
	console.log(`[api] PUT /api/commands/${req.params.name} - User:`, userInfo);
	console.log(`[api] Session user:`, req.session.user);
	console.log(`[api] Auth check:`, req.session.user ? (req.session.user.isAuthorized || req.session.user.isWhitelisted) : false);
	
	if (!req.session.user || !(req.session.user.isAuthorized || req.session.user.isWhitelisted)) {
		console.log(`[api] Access denied for user:`, userInfo);
		return res.status(403).json({ error: 'forbidden' });
	}
	const { content } = req.body;
	if (typeof content !== 'string') return res.status(400).json({ error: 'content_required' });
	try {
		const fs = require('fs');
		const path = require('path');
		const commandPath = path.join(__dirname, '../src/commands', `${req.params.name}.js`);

		if (!fs.existsSync(commandPath)) return res.status(404).json({ error: 'not_found' });

		// Lire le fichier existant
		const fileContent = fs.readFileSync(commandPath, 'utf8');

		// Vérifier que c'est une commande de type 'basic'
		if (!fileContent.includes("type: 'basic'")) {
			return res.status(400).json({ error: 'only_basic_commands' });
		}

		// Remplacer le contenu de manière plus robuste
		const escapeForJs = (str) => {
			return str
				.replace(/\\/g, '\\\\')   // Échapper les backslashes
				.replace(/'/g, "\\'")     // Échapper les apostrophes
				.replace(/"/g, '\\"')     // Échapper les guillemets doubles
				.replace(/\n/g, '\\n')    // Échapper les retours à la ligne
				.replace(/\r/g, '\\r')    // Échapper les retours chariot
				.replace(/\t/g, '\\t');   // Échapper les tabulations
		};

		// Trouver et remplacer le contenu avec une approche plus sûre
		const contentMatch = fileContent.match(/content:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/);
		if (!contentMatch) {
			return res.status(400).json({ error: 'content_pattern_not_found' });
		}

		const quote = contentMatch[1]; // Le type de quote utilisé (' ou " ou `)
		const escapedContent = escapeForJs(content);
		const newContent = fileContent.replace(
			/content:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/,
			`content: '${escapedContent}'`
		);

		fs.writeFileSync(commandPath, newContent);

		// Recharger la commande dans le registry
		delete require.cache[require.resolve(commandPath)];
		const { getRegistry } = require('../src/botInstance');
		const reg = getRegistry() || [];
		const cmd = reg.find(c => c.name === req.params.name);
		if (cmd) {
			const updatedCmd = require(commandPath);
			Object.assign(cmd, updatedCmd);
		}

		// Retourner le contenu réel du fichier après modification pour synchronisation
		const updatedFileContent = fs.readFileSync(commandPath, 'utf8');
		const updatedMatch = updatedFileContent.match(/content:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/);
		let actualContent = content; // fallback au contenu envoyé

		if (updatedMatch) {
			// Décoder les échappements JavaScript
			actualContent = updatedMatch[2]
				.replace(/\\'/g, "'")
				.replace(/\\"/g, '"')
				.replace(/\\n/g, '\n')
				.replace(/\\r/g, '\r')
				.replace(/\\t/g, '\t')
				.replace(/\\\\/g, '\\');
		}

		res.json({ success: true, name: req.params.name, content: actualContent });
	} catch (e) {
		console.error('[api] Error updating command content:', e);
		console.error('[api] Command name:', req.params.name);
		console.error('[api] Content length:', req.body.content?.length);
		console.error('[api] Content preview:', req.body.content?.substring(0, 100));
		res.status(500).json({ error: 'internal', details: e.message });
	}
});

// Route pour créer une nouvelle commande
app.post('/api/commands', (req, res) => {
	if (!req.session.user || !(req.session.user.isAuthorized || req.session.user.isWhitelisted)) return res.status(403).json({ error: 'forbidden' });
	const { name, description, content } = req.body;
	if (!name || typeof name !== 'string' || !content || typeof content !== 'string') {
		return res.status(400).json({ error: 'name_and_content_required' });
	}

	// Valider le nom (alphanumerique + tirets/underscore)
	if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
		return res.status(400).json({ error: 'invalid_name' });
	}

	try {
		const fs = require('fs');
		const path = require('path');
		const commandPath = path.join(__dirname, '../src/commands', `${name}.js`);

		if (fs.existsSync(commandPath)) {
			return res.status(409).json({ error: 'command_exists' });
		}

		const commandTemplate = `module.exports = {
  name: '${name}',
  description: '${(description || '').replace(/'/g, "\\'")}',
  showInHelp: true,
  type: 'basic',
  content: '${content.replace(/'/g, "\\'")}',
  async execute(ctx) {
    ctx.reply(module.exports.content);
  }
};
`;

		fs.writeFileSync(commandPath, commandTemplate);

		// Ajouter au registry
		const { getRegistry } = require('../src/botInstance');
		const reg = getRegistry() || [];
		const newCmd = require(commandPath);
		reg.push(newCmd);

		res.json({ success: true, name, description, content });
	} catch (e) {
		console.error('[api] Error creating command:', e);
		res.status(500).json({ error: 'internal' });
	}
});

// Route pour supprimer une commande
app.delete('/api/commands/:name', (req, res) => {
	if (!req.session.user || !(req.session.user.isAuthorized || req.session.user.isWhitelisted)) return res.status(403).json({ error: 'forbidden' });

	// Protection des commandes systeme
	const protectedCommands = ['command', 'help'];
	if (protectedCommands.includes(req.params.name)) {
		return res.status(400).json({ error: 'protected_command' });
	}

	try {
		const fs = require('fs');
		const path = require('path');
		const commandPath = path.join(__dirname, '../src/commands', `${req.params.name}.js`);

		if (!fs.existsSync(commandPath)) {
			return res.status(404).json({ error: 'not_found' });
		}

		// Supprimer le fichier
		fs.unlinkSync(commandPath);

		// Supprimer du cache require
		delete require.cache[require.resolve(commandPath)];

		// Supprimer du registry
		const { getRegistry } = require('../src/botInstance');
		const reg = getRegistry() || [];
		const index = reg.findIndex(c => c.name === req.params.name);
		if (index > -1) {
			reg.splice(index, 1);
		}

		res.json({ success: true, name: req.params.name });
	} catch (e) {
		console.error('[api] Error deleting command:', e);
		res.status(500).json({ error: 'internal' });
	}
});

module.exports = {
	start: () => app.listen(PORT, () => {
		console.log(`[serveur] Serveur web démarré sur ${BASE_URL}`);
		console.log(`[oauth] Redirect URI attendu: ${OAUTH_REDIRECT}`);
	})
};
