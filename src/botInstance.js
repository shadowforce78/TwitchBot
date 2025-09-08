// Gestion centralisée de l'instance du bot pour éviter les require circulaires
let _client = null;
let _channel = null;

function registerBot(client, channel) {
  _client = client;
  _channel = channel;
}

function getBot() {
  return { client: _client, channel: _channel };
}

async function sendMessage(message, channelOverride) {
  if (!_client) throw new Error('Bot non initialisé');
  const target = channelOverride || _channel;
  if (!target) throw new Error('Canal inconnu');
  return _client.say(target, message);
}

module.exports = { registerBot, getBot, sendMessage };
