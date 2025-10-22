// Serveur Express avec OAuth Twitch + panneau de gestion

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const axios = require('axios');
const { join } = require('path');
const DatabaseManager = require('../src/database/mysql');

const PORT = process.env.WEB_PORT || 3003;
const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const CHANNEL_LOGIN = (process.env.TWITCH_CHANNEL || '').replace(/^#/, '');
const BASE_URL = process.env.WEB_BASE_URL;
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1428892942101118976/F7cUmjzXZL3vE5JgKlrGaB24wIERsMLjjFSiWnGYVH6GBINJhR6BtutX6eQQAd-gZJ-X';
// Whitelist de logins autorisés même sans statut mod (séparés par virgule ou espaces)
const WHITELIST = (process.env.PANEL_WHITELIST || '')
	.toLowerCase()
	.split(/[\s,]+/)
	.filter(Boolean);
const OAUTH_REDIRECT = `${BASE_URL}/callback`;

const app = express();
app.use(bodyParser.json());
app.use(session({
	secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
	resave: false,
	saveUninitialized: false,
	cookie: {
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 24 * 60 * 60 * 1000, // 24 heures
		secure: false // true seulement en HTTPS
	}
}));

// Static - Panel Infrastructure
app.use('/assets', express.static(join(__dirname, 'public', 'assets')));
app.use('/img', express.static(join(__dirname, 'public', 'assets', 'img')));
app.use('/admin', express.static(join(__dirname, 'public', 'admin')));

// Index - Page d'accueil
app.get('/', (req, res) => {
	// Tous les utilisateurs (connectés ou non) -> Page d'accueil
	res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Page Giveaways
app.get('/giveaways', (req, res) => {
	res.sendFile(join(__dirname, 'public', 'giveaways.html'));
});

// Page Infos
app.get('/infos', (req, res) => {
	res.sendFile(join(__dirname, 'public', 'infos.html'));
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
app.get('/callback', async (req, res) => {
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

		// Tous les utilisateurs connectés vont à la homepage
		res.redirect('/');
	} catch (err) {
		console.error('[oauth] Erreur callback', err?.response?.data || err.message);
		res.status(500).send('Erreur OAuth');
	}
});

app.get('/no-access', (req, res) => {
	res.send('<h1>Accès refusé</h1><p>Vous devez être modérateur de la chaîne pour accéder au panneau.</p><a href="/">Retour</a>');
});

// Middleware auth panel - pour tous les utilisateurs connectés
function requireAccess(req, res, next) {
	if (!req.session.user) return res.redirect('/');
	// Permettre l'accès à tous les utilisateurs connectés
	next();
}

app.get('/panel', requireAccess, (req, res) => {
	// Vérifier si l'utilisateur est admin
	const isAdmin = req.session.user && (req.session.user.isAuthorized || req.session.user.isWhitelisted);

	if (isAdmin) {
		// Admin -> Panel d'administration
		res.sendFile(join(__dirname, 'public', 'admin', 'index.html'));
	} else {
		// Utilisateur normal -> Page d'accueil giveaways
		res.sendFile(join(__dirname, 'public', 'index.html'));
	}
});

app.get('/api/me', (req, res) => {
	if (!req.session.user) return res.json({ isAuthenticated: false });
	const { id, login, displayName, profileImage, isAuthorized, isWhitelisted } = req.session.user;
	console.log(`[api/me] User: ${login}, isAuthorized: ${isAuthorized}, isWhitelisted: ${isWhitelisted}`);
	res.json({
		isAuthenticated: true,
		id,
		login,
		displayName,
		avatar: profileImage,
		isAuthorized,
		isWhitelisted,
		isAdmin: isAuthorized || isWhitelisted,
		isModerator: isAuthorized || isWhitelisted
	});
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
// app.get('/api/force-whitelist', (req, res) => {
// 	if (req.session.user) {
// 		req.session.user.isWhitelisted = true;
// 		req.session.user.isAuthorized = true;
// 		res.json({ success: true, message: `${req.session.user.login} ajouté à la whitelist temporairement` });
// 	} else {
// 		res.status(401).json({ error: 'Not logged in' });
// 	}
// });

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

// GET logout pour redirection directe (utilisé par les boutons de déconnexion)
app.get('/logout', (req, res) => {
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

// ==== API GIVEAWAYS ====

// Middleware pour vérifier l'authentification
const requireAuth = (req, res, next) => {
	if (!req.session.user) {
		return res.status(401).json({ error: 'unauthorized', message: 'Connexion requise' });
	}
	next();
};

// Middleware pour vérifier les permissions admin
const requireAdmin = (req, res, next) => {
	if (!req.session.user || !(req.session.user.isAuthorized || req.session.user.isWhitelisted)) {
		return res.status(403).json({ error: 'forbidden', message: 'Permissions admin requises' });
	}
	next();
};

// Route pour vérifier l'auth (utilisée par le frontend)
app.get('/api/auth/check', (req, res) => {
	if (!req.session.user) {
		return res.json({ authenticated: false });
	}

	const { id, login, displayName, profileImage, isAuthorized, isWhitelisted } = req.session.user;
	res.json({
		authenticated: true,
		user: {
			id,
			login,
			display_name: displayName,
			profile_image_url: profileImage
		},
		isWhitelisted: isWhitelisted || false,
		isBroadcaster: login === CHANNEL_LOGIN
	});
});

// GET /api/giveaways - Récupérer tous les giveaways actifs
app.get('/api/giveaways', async (req, res) => {
	try {
		const db = new DatabaseManager();
		// Pour l'admin panel, récupérer tous les giveaways, sinon seulement les actifs
		const isAdmin = req.session.user && (req.session.user.isAuthorized || req.session.user.isWhitelisted);
		const giveaways = isAdmin ? await db.getAllGiveaways() : await db.getActiveGiveaways();

		// Si l'utilisateur est connecté, ajouter l'état de participation
		if (req.session.user) {
			const userId = req.session.user.id;

			// Créer l'utilisateur s'il n'existe pas
			await db.createUser(userId, req.session.user.login, req.session.user.displayName);

			// Vérifier les participations
			for (let giveaway of giveaways) {
				giveaway.is_participating = await db.isUserParticipating(giveaway.id, userId);
				giveaway.participant_count = await db.getParticipantCount(giveaway.id);
			}
		} else {
			// Ajouter le nombre de participants sans l'état de participation
			for (let giveaway of giveaways) {
				giveaway.is_participating = false;
				giveaway.participant_count = await db.getParticipantCount(giveaway.id);
			}
		}

		await db.close();
		res.json(giveaways);
	} catch (error) {
		console.error('Erreur lors de la récupération des giveaways:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

// POST /api/giveaways - Créer un nouveau giveaway (admin uniquement)
app.post('/api/giveaways', requireAuth, requireAdmin, async (req, res) => {
	try {
		const { title, reward, description, end_date, thumbnail } = req.body;

		if (!title || title.trim().length === 0) {
			return res.status(400).json({ error: 'validation', message: 'Le titre est requis' });
		}

		const giveawayData = {
			titre: title.trim(),
			description: description || null,
			image: thumbnail || null,
			prix: reward || null,
			nb_reward: 1,
			cashprize: 0.00,
			date_tirage: end_date || null
		};

		const db = new DatabaseManager();
		const giveawayId = await db.createGiveaway(giveawayData);

		await db.close();

		res.status(201).json({
			success: true,
			id: giveawayId,
			message: 'Giveaway créé avec succès'
		});
	} catch (error) {
		console.error('Erreur lors de la création du giveaway:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

// POST /api/giveaways/:id/participate - Participer à un giveaway
app.post('/api/giveaways/:id/participate', requireAuth, async (req, res) => {
	try {
		const giveawayId = parseInt(req.params.id);
		const userId = req.session.user.id;

		if (isNaN(giveawayId)) {
			return res.status(400).json({ error: 'validation', message: 'ID de giveaway invalide' });
		}

		const db = new DatabaseManager();

		// Vérifier que le giveaway existe et est ouvert
		const giveaways = await db.getActiveGiveaways();
		const giveaway = giveaways.find(g => g.id === giveawayId && g.state === 'ouvert');

		if (!giveaway) {
			await db.close();
			return res.status(404).json({ error: 'not_found', message: 'Giveaway non trouvé ou fermé' });
		}

		// Créer l'utilisateur s'il n'existe pas
		await db.createUser(userId, req.session.user.login, req.session.user.displayName);

		// Vérifier si l'utilisateur a un pass valide
		const hasValidPass = await db.hasValidPass(userId);
		if (!hasValidPass) {
			await db.close();
			return res.status(403).json({ error: 'no_valid_pass', message: 'Vous devez avoir un pass valide pour participer aux giveaways' });
		}

		// Vérifier si déjà participant
		const isParticipating = await db.isUserParticipating(giveawayId, userId);
		if (isParticipating) {
			await db.close();
			return res.status(409).json({ error: 'already_participating', message: 'Vous participez déjà à ce giveaway' });
		}

		// Ajouter la participation
		await db.addParticipation(giveawayId, userId);

		await db.close();

		res.json({
			success: true,
			message: 'Participation enregistrée avec succès'
		});
	} catch (error) {
		console.error('Erreur lors de la participation:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

// DELETE /api/giveaways/:id/leave - Quitter un giveaway
app.delete('/api/giveaways/:id/leave', requireAuth, async (req, res) => {
	try {
		const giveawayId = parseInt(req.params.id);
		const userId = req.session.user.id;

		if (isNaN(giveawayId)) {
			return res.status(400).json({ error: 'validation', message: 'ID de giveaway invalide' });
		}

		const db = new DatabaseManager();

		// Vérifier la participation
		const isParticipating = await db.isUserParticipating(giveawayId, userId);
		if (!isParticipating) {
			await db.close();
			return res.status(404).json({ error: 'not_participating', message: 'Vous ne participez pas à ce giveaway' });
		}

		// Retirer la participation
		await db.removeParticipation(giveawayId, userId);

		await db.close();

		res.json({
			success: true,
			message: 'Participation annulée avec succès'
		});
	} catch (error) {
		console.error('Erreur lors de l\'annulation:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

// PUT /api/giveaways/:id/close - Fermer un giveaway (admin uniquement)
app.put('/api/giveaways/:id/close', requireAuth, requireAdmin, async (req, res) => {
	try {
		const giveawayId = parseInt(req.params.id);

		if (isNaN(giveawayId)) {
			return res.status(400).json({ error: 'validation', message: 'ID de giveaway invalide' });
		}

		const db = new DatabaseManager();

		// Vérifier que le giveaway existe
		const giveaways = await db.getActiveGiveaways();
		const giveaway = giveaways.find(g => g.id === giveawayId);

		if (!giveaway) {
			await db.close();
			return res.status(404).json({ error: 'not_found', message: 'Giveaway non trouvé' });
		}

		if (giveaway.state === 'ferme') {
			await db.close();
			return res.status(400).json({ error: 'already_closed', message: 'Ce giveaway est déjà fermé' });
		}

		// Fermer le giveaway
		await db.closeGiveaway(giveawayId);

		await db.close();

		res.json({
			success: true,
			message: 'Giveaway fermé avec succès'
		});
	} catch (error) {
		console.error('Erreur lors de la fermeture:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

// ==== API WEBHOOK DATA (LECTURE SEULE) ====

// GET /api/webhook/users - Consulter les utilisateurs (admin uniquement)
app.get('/api/webhook/users', requireAuth, requireAdmin, async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 50;
		const offset = (page - 1) * limit;

		const db = new DatabaseManager();

		const users = await db.getAllUsers(limit, offset);
		const totalCount = await db.getUsersCount();

		await db.close();

		res.json({
			users,
			pagination: {
				page,
				limit,
				total: totalCount,
				pages: Math.ceil(totalCount / limit)
			}
		});
	} catch (error) {
		console.error('Erreur lors de la récupération des utilisateurs:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

// GET /api/webhook/passes - Consulter les passes (admin uniquement)
app.get('/api/webhook/passes', requireAuth, requireAdmin, async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 50;
		const offset = (page - 1) * limit;

		const db = new DatabaseManager();

		const passes = await db.getAllPasses(limit, offset);
		const totalCount = await db.getPassesCount();
		const validCount = await db.getValidPassesCount();

		await db.close();

		res.json({
			passes,
			stats: {
				total: totalCount,
				valid: validCount,
				invalid: totalCount - validCount
			},
			pagination: {
				page,
				limit,
				total: totalCount,
				pages: Math.ceil(totalCount / limit)
			}
		});
	} catch (error) {
		console.error('Erreur lors de la récupération des passes:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

// GET /api/webhook/stats - Statistiques générales (admin uniquement)
app.get('/api/webhook/stats', requireAuth, requireAdmin, async (req, res) => {
	try {
		const db = new DatabaseManager();

		const usersCount = await db.getUsersCount();
		const passesCount = await db.getPassesCount();
		const validPassesCount = await db.getValidPassesCount();

		await db.close();

		res.json({
			users: {
				total: usersCount
			},
			passes: {
				total: passesCount,
				valid: validPassesCount,
				invalid: passesCount - validPassesCount,
				validPercentage: passesCount > 0 ? Math.round((validPassesCount / passesCount) * 100) : 0
			}
		});
	} catch (error) {
		console.error('Erreur lors de la récupération des statistiques:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

// Route /giveaway supprimée - intégrée dans la nouvelle infrastructure

// ==== ROUTES API ADDITIONNELLES POUR ADMIN PANEL ====

// Modifier un giveaway existant
app.put('/api/giveaways/:id', requireAuth, requireAdmin, async (req, res) => {
	try {
		const { id } = req.params;
		const { title, reward, description, end_date, thumbnail } = req.body;

		if (!title || !reward || !end_date) {
			return res.status(400).json({ error: 'validation', message: 'Titre, récompense et date de fin requis' });
		}

		const db = new DatabaseManager();
		await db.updateGiveaway(parseInt(id), {
			title,
			reward,
			description: description || '',
			end_date,
			thumbnail: thumbnail || ''
		});
		await db.close();

		res.json({ success: true, message: 'Giveaway modifié avec succès' });
	} catch (error) {
		console.error('Erreur modification giveaway:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

// Supprimer un giveaway
app.delete('/api/giveaways/:id', requireAuth, requireAdmin, async (req, res) => {
	try {
		const { id } = req.params;
		const db = new DatabaseManager();

		await db.deleteGiveaway(parseInt(id));
		await db.close();
		res.json({ success: true, message: 'Giveaway supprimé avec succès' });
	} catch (error) {
		console.error('Erreur suppression giveaway:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

// Tirer au sort un gagnant
app.post('/api/giveaways/:id/draw-winner', requireAuth, requireAdmin, async (req, res) => {
	try {
		const { id } = req.params;
		const db = new DatabaseManager();

		// Récupérer les participants du giveaway
		const participants = await db.getGiveawayParticipants(parseInt(id));

		if (participants.length === 0) {
			await db.close();
			return res.status(400).json({ error: 'no_participants', message: 'Aucun participant pour ce giveaway' });
		}

		// Sélectionner un gagnant aléatoire
		const winner = participants[Math.floor(Math.random() * participants.length)];

		// Marquer le giveaway comme terminé et enregistrer le gagnant
		await db.setGiveawayWinner(parseInt(id), winner.id_twitch);

		// Récupérer les informations complètes du giveaway
		const giveaway = await db.getGiveawayById(parseInt(id));

		// Envoyer notification Discord
		await sendDiscordNotification(
			{ username: winner.username, displayName: winner.username, id_twitch: winner.id_twitch },
			{ ...giveaway, participant_count: participants.length }
		);

		res.json({
			success: true,
			message: 'Gagnant tiré au sort',
			winner: {
				username: winner.username,
				displayName: winner.username,
				id_twitch: winner.id_twitch
			},
			giveaway: {
				titre: giveaway.titre,
				prix: giveaway.prix,
				reward: giveaway.prix
			}
		});
		await db.close();
	} catch (error) {
		console.error('Erreur tirage gagnant:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

// Retirer au sort un gagnant (reroll)
app.post('/api/giveaways/:id/reroll-winner', requireAuth, requireAdmin, async (req, res) => {
	try {
		const { id } = req.params;
		const db = new DatabaseManager();

		// Récupérer le giveaway actuel pour voir l'ancien gagnant
		const giveaway = await db.getGiveawayById(parseInt(id));

		if (!giveaway) {
			return res.status(404).json({ error: 'not_found', message: 'Giveaway introuvable' });
		}

		if (giveaway.state !== 'ferme') {
			return res.status(400).json({ error: 'invalid_state', message: 'Le giveaway doit être fermé pour retirer au sort' });
		}

		const oldWinnerId = giveaway.winner_twitch_id;

		// Récupérer les participants du giveaway
		const allParticipants = await db.getGiveawayParticipants(parseInt(id));

		if (allParticipants.length === 0) {
			return res.status(400).json({ error: 'no_participants', message: 'Aucun participant pour ce giveaway' });
		}

		// Filtrer l'ancien gagnant pour ne pas le retirer
		const participants = oldWinnerId
			? allParticipants.filter(p => p.id_twitch !== oldWinnerId)
			: allParticipants;

		if (participants.length === 0) {
			return res.status(400).json({
				error: 'no_other_participants',
				message: 'Aucun autre participant disponible pour le reroll'
			});
		}

		// Sélectionner un nouveau gagnant aléatoire
		const winner = participants[Math.floor(Math.random() * participants.length)];

		// Mettre à jour le gagnant
		await db.setGiveawayWinner(parseInt(id), winner.id_twitch);

		// Envoyer notification Discord pour le reroll
		await sendDiscordNotification(
			{ username: winner.username, displayName: winner.username, id_twitch: winner.id_twitch },
			{ ...giveaway, participant_count: allParticipants.length },
			true // isReroll
		);

		res.json({
			success: true,
			message: 'Nouveau gagnant tiré au sort',
			winner: {
				username: winner.username,
				displayName: winner.username,
				id_twitch: winner.id_twitch
			},
			giveaway: {
				titre: giveaway.titre,
				prix: giveaway.prix,
				reward: giveaway.prix
			}
		});
		await db.close();
	} catch (error) {
		console.error('Erreur reroll gagnant:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

// ==== FONCTION DE NOTIFICATION DISCORD ====
async function sendDiscordNotification(winner, giveaway, isReroll = false) {
	try {
		const embed = {
			title: isReroll ? "🔄 Giveaway Reroll - Nouveau Gagnant !" : "🎉 Giveaway Terminé - Nouveau Gagnant !",
			description: `Le giveaway **${giveaway.titre}** ${isReroll ? 'a été retiré au sort' : 'est terminé'} !`,
			color: isReroll ? 0xFFA500 : 0x9146FF, // Orange pour reroll, Violet Twitch pour normal
			fields: [
				{
					name: "🏆 Gagnant",
					value: winner.username || winner.displayName,
					inline: true
				},
				{
					name: "🎁 Récompense",
					value: giveaway.prix || "Récompense non spécifiée",
					inline: true
				},
				{
					name: "👥 Participants",
					value: giveaway.participant_count ? giveaway.participant_count.toString() : "0",
					inline: true
				}
			],
			thumbnail: giveaway.image ? { url: giveaway.image } : undefined,
			timestamp: new Date().toISOString(),
			footer: {
				text: isReroll ? "TwitchBot Giveaway System - Reroll" : "TwitchBot Giveaway System"
			}
		};

		await axios.post(DISCORD_WEBHOOK_URL, {
			username: "TwitchBot Giveaways",
			avatar_url: "https://static-cdn.jtvnw.net/jtv_user_pictures/8a6381c7-d0c0-4576-b179-38bd5ce1d6af-profile_image-300x300.png",
			embeds: [embed]
		});

		console.log(`[Discord] Notification ${isReroll ? 'reroll' : 'tirage'} envoyée pour le giveaway #${giveaway.id}`);
	} catch (error) {
		console.error('[Discord] Erreur envoi webhook:', error.message);
	}
}

// ==== VÉRIFICATION AUTOMATIQUE DES GIVEAWAYS ====
async function checkGiveawaysForAutoDraw() {
	console.log('[Auto-Draw] Vérification des giveaways en cours...');
	try {
		const db = new DatabaseManager();
		await db.init(); // S'assurer que la connexion est initialisée

		// Récupérer TOUS les giveaways actifs avec une date de tirage
		// On va filtrer côté JavaScript pour éviter les problèmes de fuseau horaire
		const giveaways = await db.query(`
			SELECT g.*, COUNT(p.user_id) as participant_count
			FROM giveaway g
			LEFT JOIN giveaway_participants p ON g.id = p.giveaway_id
			WHERE g.state = 'ouvert' 
			AND g.date_tirage IS NOT NULL
			GROUP BY g.id
		`);

		console.log(`[Auto-Draw] ${giveaways.length} giveaway(s) actif(s) avec date trouvé(s)`);

		// Filtrer côté JavaScript pour gérer correctement les fuseaux horaires
		const now = new Date();
		const giveawaysToProcess = giveaways.filter(g => {
			const drawDate = new Date(g.date_tirage);
			return drawDate <= now;
		});

		console.log(`[Auto-Draw] ${giveawaysToProcess.length} giveaway(s) à tirer au sort maintenant`);

		for (const giveaway of giveawaysToProcess) {
			console.log(`[Auto-Draw] Tirage automatique pour le giveaway #${giveaway.id}: ${giveaway.titre}`);
			console.log(`[Auto-Draw] Date de tirage: ${giveaway.date_tirage}, Maintenant: ${now.toISOString()}`);

			// Récupérer les participants
			const participants = await db.getGiveawayParticipants(giveaway.id);

			console.log(`[Auto-Draw] ${participants.length} participant(s) pour le giveaway #${giveaway.id}`);

			if (participants.length === 0) {
				console.log(`[Auto-Draw] Aucun participant pour le giveaway #${giveaway.id}, fermeture sans gagnant`);
				await db.closeGiveaway(giveaway.id);
				continue;
			}

			// Sélectionner un gagnant aléatoire
			const winner = participants[Math.floor(Math.random() * participants.length)];

			// Enregistrer le gagnant et fermer le giveaway
			await db.setGiveawayWinner(giveaway.id, winner.id_twitch);

			console.log(`[Auto-Draw] Gagnant tiré au sort: ${winner.username} pour le giveaway #${giveaway.id}`);

			// Envoyer la notification Discord
			await sendDiscordNotification(
				{ username: winner.username, displayName: winner.username, id_twitch: winner.id_twitch },
				{ ...giveaway, participant_count: participants.length }
			);
		}

		await db.close();
		console.log('[Auto-Draw] Vérification terminée');
	} catch (error) {
		console.error('[Auto-Draw] Erreur lors de la vérification des giveaways:', error);
	}
}

// Démarrer la vérification automatique toutes les minutes
let autoDrawInterval = null;

function startAutoDrawCheck() {
	if (autoDrawInterval) {
		clearInterval(autoDrawInterval);
	}

	// Vérifier immédiatement au démarrage
	checkGiveawaysForAutoDraw();

	// Puis vérifier toutes les minutes
	autoDrawInterval = setInterval(checkGiveawaysForAutoDraw, 60 * 1000);
	console.log('[Auto-Draw] Système de tirage automatique démarré (vérification toutes les minutes)');
}

// Endpoint de test pour forcer une vérification manuelle
app.post('/api/giveaways/check-auto-draw', requireAuth, requireAdmin, async (req, res) => {
	try {
		console.log('[API] Vérification manuelle du système auto-draw demandée');
		await checkGiveawaysForAutoDraw();
		res.json({ success: true, message: 'Vérification effectuée' });
	} catch (error) {
		console.error('[API] Erreur vérification auto-draw:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur lors de la vérification' });
	}
});

// Récupérer tous les utilisateurs
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
	try {
		const db = new DatabaseManager();
		const users = await db.getAllUsers();
		await db.close();
		res.json(users);
	} catch (error) {
		console.error('Erreur récupération utilisateurs:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

// Récupérer les données webhook consolidées
app.get('/api/webhook-data', requireAuth, requireAdmin, async (req, res) => {
	try {
		const db = new DatabaseManager();

		// Récupérer les follows et subscriptions récents
		const follows = await db.getRecentFollows(50);
		const subscriptions = await db.getRecentSubscriptions(50);

		await db.close();
		res.json({
			follows: follows || [],
			subscriptions: subscriptions || []
		});
	} catch (error) {
		console.error('Erreur récupération données webhook:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

// Statut du bot
app.get('/api/bot-status', requireAuth, requireAdmin, (req, res) => {
	try {
		// Ces informations devraient venir du bot lui-même
		// Pour l'instant, on retourne des données mockées
		const status = {
			connected: true, // À remplacer par le vrai statut
			channel: CHANNEL_LOGIN,
			commandCount: Object.keys(global.commandSystem?.commands || {}).length,
			uptime: '2h 34m' // À calculer depuis le démarrage
		};

		res.json(status);
	} catch (error) {
		console.error('Erreur récupération statut bot:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

// Contrôles du bot (démarrer/arrêter)
app.post('/api/bot/start', requireAuth, requireAdmin, (req, res) => {
	try {
		// À implémenter: démarrer le bot
		res.json({ success: true, message: 'Bot démarré' });
	} catch (error) {
		console.error('Erreur démarrage bot:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

app.post('/api/bot/stop', requireAuth, requireAdmin, (req, res) => {
	try {
		// À implémenter: arrêter le bot
		res.json({ success: true, message: 'Bot arrêté' });
	} catch (error) {
		console.error('Erreur arrêt bot:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur serveur' });
	}
});

// API pour envoyer un email de contact
app.post('/api/contact', async (req, res) => {
	try {
		const { name, email, subject, message } = req.body;
		
		// Validation
		if (!name || !email || !message) {
			return res.status(400).json({ error: 'validation', message: 'Tous les champs obligatoires doivent être remplis' });
		}
		
		// Validation email
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return res.status(400).json({ error: 'validation', message: 'Email invalide' });
		}
		
		// Vérifier que les variables d'environnement sont définies
		if (!process.env.SMTP_SERVER || !process.env.MAIL || !process.env.MAIL_PASSWORD) {
			console.error('[contact] Variables d\'environnement manquantes:', {
				SMTP_SERVER: !!process.env.SMTP_SERVER,
				MAIL: !!process.env.MAIL,
				MAIL_PASSWORD: !!process.env.MAIL_PASSWORD
			});
			return res.status(500).json({ 
				error: 'config_error', 
				message: 'Configuration email incomplète' 
			});
		}
		
		console.log('[contact] Configuration SMTP:', {
			host: process.env.SMTP_SERVER,
			port: process.env.SMTP_PORT,
			user: process.env.MAIL,
			passwordLength: process.env.MAIL_PASSWORD?.length
		});
		
		// Configuration Nodemailer
		const nodemailer = require('nodemailer');
		
		// Essayer d'abord avec le port configuré (465), sinon fallback sur 587
		let transportConfig = {
			host: process.env.SMTP_SERVER,
			port: parseInt(process.env.SMTP_PORT) || 465,
			secure: parseInt(process.env.SMTP_PORT) === 465, // true pour 465, false pour 587
			auth: {
				user: process.env.MAIL,
				pass: process.env.MAIL_PASSWORD
			},
			tls: {
				rejectUnauthorized: false,
				minVersion: 'TLSv1.2'
			}
		};
		
		// Si le port est 465 et que ça échoue, on essaiera 587
		let transporter = nodemailer.createTransport(transportConfig);
		
		// Vérifier la connexion
		try {
			await transporter.verify();
			console.log('[contact] Serveur SMTP prêt (port', transportConfig.port + ')');
		} catch (verifyError) {
			console.error('[contact] Erreur avec port', transportConfig.port, ':', verifyError.message);
			
			// Essayer avec le port 587 (STARTTLS) si 465 échoue
			if (transportConfig.port === 465) {
				console.log('[contact] Tentative avec port 587 (STARTTLS)...');
				transportConfig.port = 587;
				transportConfig.secure = false;
				transporter = nodemailer.createTransport(transportConfig);
				
				try {
					await transporter.verify();
					console.log('[contact] Serveur SMTP prêt avec port 587');
				} catch (retry587Error) {
					console.error('[contact] Échec avec port 587:', retry587Error.message);
					return res.status(500).json({ 
						error: 'smtp_error', 
						message: 'Impossible de se connecter au serveur email. Veuillez contacter l\'administrateur.' 
					});
				}
			} else {
				return res.status(500).json({ 
					error: 'smtp_error', 
					message: 'Configuration email incorrecte. Veuillez contacter l\'administrateur.' 
				});
			}
		}
		
		// Email à envoyer
		const mailOptions = {
			from: process.env.MAIL,
			to: process.env.MAIL, // Envoyer à soi-même
			replyTo: email, // Pour pouvoir répondre directement
			subject: `[Contact Site] ${subject}`,
			html: `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<h2 style="color: #00D9A3;">Nouveau message de contact</h2>
					<div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
						<p><strong>Nom :</strong> ${name}</p>
						<p><strong>Email :</strong> ${email}</p>
						<p><strong>Sujet :</strong> ${subject}</p>
					</div>
					<div style="background: white; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
						<h3 style="color: #333; margin-top: 0;">Message :</h3>
						<p style="white-space: pre-wrap; color: #555; line-height: 1.6;">${message}</p>
					</div>
					<div style="margin-top: 20px; padding: 15px; background: #e8f5f1; border-radius: 8px;">
						<p style="margin: 0; color: #666; font-size: 14px;">
							💡 Vous pouvez répondre directement à cet email pour contacter ${name}
						</p>
					</div>
				</div>
			`
		};
		
		// Envoyer l'email
		await transporter.sendMail(mailOptions);
		
		console.log(`[contact] Email envoyé de ${email} (${name})`);
		res.json({ success: true, message: 'Message envoyé avec succès' });
		
	} catch (error) {
		console.error('[contact] Erreur envoi email:', error);
		res.status(500).json({ error: 'internal', message: 'Erreur lors de l\'envoi du message' });
	}
});

// Auto-start si ce fichier est exécuté directement
if (require.main === module) {
	app.listen(PORT, () => {
		console.log(`[serveur] Serveur web démarré sur ${BASE_URL}`);
		console.log(`[oauth] Redirect URI attendu: ${OAUTH_REDIRECT}`);

		// Démarrer le système de tirage automatique
		startAutoDrawCheck();
	});
}

module.exports = {
	start: () => app.listen(PORT, () => {
		console.log(`[serveur] Serveur web démarré sur ${BASE_URL}`);
		console.log(`[oauth] Redirect URI attendu: ${OAUTH_REDIRECT}`);

		// Démarrer le système de tirage automatique
		startAutoDrawCheck();
	})
};
