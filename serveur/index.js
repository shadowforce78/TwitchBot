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
app.use('/admin', express.static(join(__dirname, 'public', 'admin')));

// Index - Page d'accueil
app.get('/', (req, res) => {
	// Tous les utilisateurs (connectés ou non) -> Page d'accueil
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
			return res.status(400).json({ error: 'no_participants', message: 'Aucun participant pour ce giveaway' });
		}

	// Sélectionner un gagnant aléatoire
	const winner = participants[Math.floor(Math.random() * participants.length)];

	// Marquer le giveaway comme terminé et enregistrer le gagnant
	await db.setGiveawayWinner(parseInt(id), winner.id_twitch);

	// Récupérer les informations complètes du giveaway
	const giveaway = await db.getGiveawayById(parseInt(id));

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

// Auto-start si ce fichier est exécuté directement
if (require.main === module) {
	app.listen(PORT, () => {
		console.log(`[serveur] Serveur web démarré sur ${BASE_URL}`);
		console.log(`[oauth] Redirect URI attendu: ${OAUTH_REDIRECT}`);
	});
}

module.exports = {
	start: () => app.listen(PORT, () => {
		console.log(`[serveur] Serveur web démarré sur ${BASE_URL}`);
		console.log(`[oauth] Redirect URI attendu: ${OAUTH_REDIRECT}`);
	})
};
