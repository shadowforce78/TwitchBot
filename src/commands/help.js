module.exports = {
  name: 'help',
  description: 'Liste les commandes disponibles.',
  showInHelp: false, // On ne s’affiche pas soi-même pour éviter le bruit (optionnel)
  async execute(ctx) {
    const list = ctx.registry
      .filter(c => c.showInHelp)
      .map(c => `!${c.name}`)
      .join(', ');
    ctx.reply(list ? `Commandes: ${list}` : 'Aucune commande disponible.');
  }
};
