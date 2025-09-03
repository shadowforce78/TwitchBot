#!/usr/bin/env node
// Écrit un token utilisateur (fourni en argument) directement dans .env comme TWITCH_OAUTH_TOKEN
const fs = require('fs');
const path = require('path');

const tokenArg = process.argv[2];
if (!tokenArg) {
  console.error('Usage: node scripts/set-token.js <access_token_ou_oauth:token>');
  process.exit(1);
}
const token = tokenArg.startsWith('oauth:') ? tokenArg : `oauth:${tokenArg}`;

const envPath = path.resolve(process.cwd(), '.env');
let content = '';
try { content = fs.readFileSync(envPath, 'utf8'); } catch {}
if (content.match(/^TWITCH_OAUTH_TOKEN=/m)) {
  content = content.replace(/^TWITCH_OAUTH_TOKEN=.*$/m, `TWITCH_OAUTH_TOKEN=${token}`);
} else {
  content += (content.endsWith('\n') ? '' : '\n') + `TWITCH_OAUTH_TOKEN=${token}\n`;
}
fs.writeFileSync(envPath, content, 'utf8');
console.log('✔ TWITCH_OAUTH_TOKEN mis à jour dans .env');
