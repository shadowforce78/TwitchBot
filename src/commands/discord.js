module.exports = {
	name: 'discord',
	description: 'Renvoie une invitation Discord.',
	type: 'basic',
	content: "🚨 N\'hésitez pas à rejoindre le discord pour parler hors-stream ! (https://discord.gg/JXmzA75QXe)",
	showInHelp: true,
	async execute(ctx) {
		ctx.reply(module.exports.content);
	}
};