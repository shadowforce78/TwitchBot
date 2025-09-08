// Gestion centralisée de l'instance du bot pour éviter les require circulaires
let _client = null;
let _channel = null;
let _registry = null;

function registerBot(client, channel, registry) {
  _client = client;
  _channel = channel;
  if (Array.isArray(registry)) _registry = registry;
}

function getBot() {
  return { client: _client, channel: _channel, registry: _registry };
}

async function sendMessage(message, channelOverride) {
  if (!_client) throw new Error('Bot non initialisé');
  const target = channelOverride || _channel;
  if (!target) throw new Error('Canal inconnu');
  return _client.say(target, message);
}

function getRegistry() { return _registry; }

module.exports = { registerBot, getBot, sendMessage, getRegistry };
