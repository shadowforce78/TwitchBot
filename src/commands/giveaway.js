module.exports = {
    name: 'giveaway',
    description: 'Informations sur le giveaway en cours.',
    type: 'basic',
    content: '🎉 GIVEAWAYY, pour en savoir plus sur les conditions de participation et/ou les prix : https://giveaway.saumondeluxe.com💥',
    showInHelp: true,
    async execute(ctx) {
        ctx.reply(module.exports.content);
    }
};
