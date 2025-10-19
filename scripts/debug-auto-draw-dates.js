const DatabaseManager = require('../src/database/mysql');

async function debugAutoDraw() {
    console.log('=== DEBUG AUTO-DRAW DATES ===\n');
    
    const db = new DatabaseManager();
    await db.init();
    
    // Date actuelle
    const now = new Date();
    console.log('📅 Date actuelle du serveur:');
    console.log(`   - ISO: ${now.toISOString()}`);
    console.log(`   - Local: ${now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`);
    console.log(`   - Timestamp: ${now.getTime()}`);
    console.log(`   - UTC: ${now.toUTCString()}\n`);
    
    // Récupérer tous les giveaways actifs avec date
    const giveaways = await db.query(`
        SELECT g.*, COUNT(p.user_id) as participant_count
        FROM giveaway g
        LEFT JOIN giveaway_participants p ON g.id = p.giveaway_id
        WHERE g.state = 'ouvert' 
        AND g.date_tirage IS NOT NULL
        GROUP BY g.id
    `);
    
    console.log(`🎁 ${giveaways.length} giveaway(s) actif(s) avec date de tirage:\n`);
    
    for (const g of giveaways) {
        console.log(`\n--- Giveaway #${g.id}: ${g.titre} ---`);
        console.log(`État: ${g.state}`);
        console.log(`Participants: ${g.participant_count}`);
        console.log(`\n📅 Date de tirage (brute de MySQL):`);
        console.log(`   - Valeur: ${g.date_tirage}`);
        
        const drawDate = new Date(g.date_tirage);
        console.log(`\n📅 Date de tirage (convertie en JS):`);
        console.log(`   - ISO: ${drawDate.toISOString()}`);
        console.log(`   - Local: ${drawDate.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`);
        console.log(`   - Timestamp: ${drawDate.getTime()}`);
        console.log(`   - UTC: ${drawDate.toUTCString()}`);
        
        console.log(`\n⏰ Comparaison:`);
        console.log(`   - Date tirage <= Maintenant ? ${drawDate <= now}`);
        console.log(`   - Différence: ${Math.round((drawDate - now) / 1000)} secondes`);
        
        if (drawDate <= now) {
            console.log(`   ✅ PRÊT POUR TIRAGE AUTOMATIQUE`);
        } else {
            const remainingMinutes = Math.ceil((drawDate - now) / (60 * 1000));
            console.log(`   ⏳ Tirage dans ${remainingMinutes} minute(s)`);
        }
        
        // Afficher les participants
        if (g.participant_count > 0) {
            const participants = await db.getGiveawayParticipants(g.id);
            console.log(`\n👥 Participants (${participants.length}):`);
            participants.forEach(p => {
                console.log(`   - ${p.username} (${p.id_twitch})`);
            });
        } else {
            console.log(`\n⚠️  Aucun participant`);
        }
    }
    
    await db.close();
    console.log('\n=== FIN DEBUG ===');
}

debugAutoDraw().catch(console.error);
