const { getAppAccessToken, getUserId, getStreamInfo } = require('../lib/helix');

module.exports = {
    name: 'uptime',
    description: 'Affiche la durée du live en cours.',
    showInHelp: true,
    async execute(ctx) {
        const { clientId, clientSecret, channelLogin, reply } = ctx;
        try {
            const token = await getAppAccessToken(clientId, clientSecret);
            const userId = await getUserId(token, clientId, channelLogin);
            const stream = await getStreamInfo(token, clientId, userId);
            if (stream) {
                const started = new Date(stream.started_at);
                const diffMs = Date.now() - started.getTime();
                const mins = Math.floor(diffMs / 60000);
                const hours = Math.floor(mins / 60);
                const rem = mins % 60;
                const text = hours > 0 ? `${hours}h${rem}m` : `${rem}m`;
                reply(`Le live est en cours depuis ${text}.`);
            } else {
                reply('Le live est hors-ligne.');
            }
        } catch (err) {
            console.error('[cmd:uptime]', err?.response?.data || err.message);
            reply('Erreur uptime.');
        }
    }
};
