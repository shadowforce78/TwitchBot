const fs = require('fs');
const path = require('path');

function loadCommands(dir) {
    const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.js') && !f.startsWith('_'));
    const commands = [];
    for (const file of files) {
        const full = path.join(dir, file);
        try {
            const mod = require(full);
            if (mod && mod.name && typeof mod.execute === 'function') {
                if (typeof mod.enabled === 'undefined') mod.enabled = true; // valeur par défaut
                commands.push(mod);
            } else {
                console.warn('[commands] Fichier ignoré (format invalide):', file);
            }
        } catch (err) {
            console.error('[commands] Erreur chargement', file, err.message);
        }
    }
    return commands;
}

module.exports = { loadCommands };
