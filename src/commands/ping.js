module.exports = {
  name: 'ping',
  description: 'Répond pong.',
  showInHelp: true,
  async execute(ctx) {
    ctx.reply('pong');
  }
};
