const { content } = require("./aquarium");

module.exports = {
  name: 'sub',
  type: 'basic',
  description: 'Informations sur les abonnements.',
  content:"🌙 Envie de vous sub et d\'accéder à des récompenses inédites ? Rendez-vous sur twitch.gmocellin.com ✨",
  showInHelp: true,
  async execute(ctx) {
    ctx.reply(module.exports.content);
  }
};
