# TwitchBot

Un bot Twitch minimal (IRC via WebSocket) qui se connecte au chat et répond à `!ping`.

## Prérequis
- Node.js 18+
- Un compte Twitch pour le bot
- Un token utilisateur OAuth avec scopes `chat:read` et `chat:edit`

> Important: un "App Access Token" (client_credentials) ne fonctionne PAS pour l'IRC. Il faut un token utilisateur.

## Configuration
1. Dupliquez `.env.example` en `.env` et renseignez:
   - `TWITCH_USERNAME`: le nom d'utilisateur du compte bot (ex: `monbot`)
   - `TWITCH_CHANNEL`: la chaîne à rejoindre (sans `#`)
   - `TWITCH_OAUTH_TOKEN`: le token utilisateur (avec ou sans préfixe `oauth:`)

### Obtenir un token utilisateur rapidement
- Méthode simple (hors prod): utilisez https://twitchapps.com/tmi/ pour générer un token `oauth:...` lié à votre compte. Donne accès au chat (chat:read/edit implicite via IRC).
- Méthode propre (prod): implémentez l'OAuth Authorization Code Flow pour obtenir un access token avec scopes `chat:read chat:edit`.

### Script local pour obtenir un token (PKCE, sans client secret)
1. Créez une application sur https://dev.twitch.tv/console/apps
   - Ajoutez une Redirect URL: `http://localhost:3000/callback`
   - Récupérez le Client ID
2. Dans `.env`, renseignez:
   - `TWITCH_CLIENT_ID=<votre_client_id>`
   - `TWITCH_REDIRECT_URI=http://localhost:3000/callback` (par défaut)
3. Lancez le script:
```pwsh
npm run get-token
```
4. Autorisez l’application dans le navigateur. Le token sera écrit automatiquement dans `.env` sous `TWITCH_OAUTH_TOKEN`.

### Astuces / Dépannage
- Erreur `Login unsuccessful`:
   - Le `TWITCH_USERNAME` doit être exactement le compte qui possède le token.
   - Le token doit être un token UTILISATEUR (pas un App Token) et valide.
   - Essayez de régénérer via `npm run get-user-token`.
- User/Channel en minuscules: `index.js` force en minuscules pour éviter des soucis de casse avec IRC.

## Installation
```pwsh
npm install
```

## Démarrage
```pwsh
npm start
```

Si la connexion réussit, vous verrez les messages IRC et le bot répondra `Pong!` quand quelqu'un écrit `!ping` dans le chat.

## Notes
- Le bot répond aux PING par des PONG pour garder la connexion ouverte.
- Vous pouvez étendre `sendMessage` et le parsing pour ajouter d'autres commandes.
