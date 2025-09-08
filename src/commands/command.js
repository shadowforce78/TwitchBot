module.exports = {
    name: 'command',
    description: 'Active ou désactive une commande. Usage: !command enable|disable <nom>',
    showInHelp: false,
    enabled: true,
    async execute(ctx) {
        if (!ctx.isMod) {
            return ctx.reply('Permission refusée (mod/broadcaster requis).');
        }
        const [action, targetName] = ctx.args;
        if (!action || !targetName) {
            return ctx.reply('Usage: !command enable|disable <nom>');
        }
        const target = ctx.registry.find(c => c.name === targetName.toLowerCase());
        if (!target) return ctx.reply('Commande introuvable.');
        if (target.name === 'command') return ctx.reply('Impossible sur soi.');
        if (!['enable', 'disable'].includes(action)) {
            return ctx.reply('Action inconnue (enable/disable).');
        }
        if (action === 'enable') {
            if (target.enabled) return ctx.reply(`'${target.name}' déjà activée.`);
            target.enabled = true;
        } else {
            if (!target.enabled) return ctx.reply(`'${target.name}' déjà désactivée.`);
            target.enabled = false;
        }
        // Sauvegarde état
        try {
            const { saveState } = require('../storage/commandState');
            saveState(ctx.registry);
        } catch (e) {
            console.warn('[commands][state] save error:', e.message);
        }
        return ctx.reply(`Commande '${target.name}' ${target.enabled ? 'activée' : 'désactivée'}.`);
    }
};