module.exports = {
  name: 'aquarium',
  description: 'Informations sur l\'aquarium.',
  showInHelp: true,
  type: 'basic',
  content: ' 🐟 Heyyy, j\'ai 3 aquariums dans ma chambre, avec des crevettes red chery (fire sakura) 🦐 un betta splendens (William ce beau gosse 🖤), des cory pygmées (trop chouuu 🐈), et des planorbes et physes bien évidemment 🐌 !',
  async execute(ctx) {
    ctx.reply(module.exports.content);
  }
};
