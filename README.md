# TwitchBot

Bot Twitch minimal en Node.js (tmi.js) avec utilitaires Helix et un helper OAuth local (dans `scripts/auth.js`) pour générer un token de chat.

## Prérequis
- Node.js 18+
- Un fichier `.env` à la racine avec:
```
TWITCH_USERNAME=...
TWITCH_CHANNEL=...
TWITCH_CLIENT_ID=...
TWITCH_CLIENT_SECRET=...
# Optionnel pour OAuth local
TWITCH_REDIRECT_URI=http://localhost:3000/callback
# Une fois généré via `npm run auth`:
# TWITCH_CHAT_OAUTH=oauth:xxxxxxxxxxxxxxxx
```

## Installer
```powershell
npm install
```

## Générer un token de chat (optionnel mais requis pour envoyer des messages)
```powershell
npm run auth
```
- Ouvrez le lien « Se connecter avec Twitch »
- Autorisez les scopes
- Copiez la valeur affichée (commence par `oauth:`) dans `.env` sous la forme `TWITCH_CHAT_OAUTH=oauth:xxxxxxxx`

## Lancer le bot
```powershell
npm start
```

### Commandes incluses
- `!ping` → répond "pong" (nécessite TWITCH_CHAT_OAUTH)
- `!uptime` → durée du live en cours (utilise l'API Helix)

## Notes
- Les identifiants CLIENT_ID et CLIENT_SECRET sont utilisés pour les appels Helix et l'OAuth utilisateur. Ne les partagez pas publiquement.
- Sans `TWITCH_CHAT_OAUTH`, le bot démarre en mode lecture seule (il ne répondra pas aux commandes).
- Le token généré est un user access token; régénérez‑le si vous révoquez les accès côté Twitch.
