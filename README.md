# TwitchBot

Bot Twitch minimal en Node.js (tmi.js) avec utilitaires Helix et un helper OAuth local pour générer un token de chat.

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

## Générer un token de chat (optionnel mais recommandé pour parler dans le chat)
```powershell
npm run auth
```
- Ouvrez le lien « Se connecter avec Twitch »
- Autorisez les scopes
- Copiez la valeur affichée (commence par `oauth:`) dans `.env` en `TWITCH_CHAT_OAUTH=`

## Lancer le bot
```powershell
npm start
```

### Commandes incluses
- `!ping` → répond "pong" (nécessite TWITCH_CHAT_OAUTH)
- `!uptime` → durée du live en cours (utilise l'API Helix)

## Notes
- Les identifiants CLIENT_ID et CLIENT_SECRET sont utilisés pour les appels Helix et l'OAuth utilisateur. Ne les partagez pas publiquement.
