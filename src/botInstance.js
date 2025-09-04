// Exporte une fonction sendMessage pour le serveur web
const { client, isAuthenticated, CHANNEL } = require('./index');

async function sendMessage(message) {
  if (!isAuthenticated()) throw new Error('Bot non authentifié');
  return client.say(CHANNEL, message);
}

module.exports = { sendMessage };
