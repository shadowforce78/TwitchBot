const { content } = require("./aquarium");

module.exports = {
    name: 'socials',
    type: 'basic',
    description: 'Renvoie mes réseaux sociaux.',
    content : `Envie de me suivre plus loin ? 
❤️ Youtube : https://www.youtube.com/@kiwi_tfb 
🩷 Insta : https://instagram.com/kiwi_tfb  
🩶 Portfolio : https://portfolio.gmocellin.com/
🖤 Twitter : https://x.com/KiwiTFB`,
    showInHelp: true,
    async execute(ctx) {
        ctx.reply(module.exports.content);
    }
};
