// Script de test pour le système auto-draw
require('dotenv').config();
const DatabaseManager = require('../src/database/mysql');

async function testAutoDraw() {
    console.log('=== TEST DU SYSTÈME AUTO-DRAW ===\n');
    
    const db = new DatabaseManager();
    
    try {
        await db.init();
        console.log('✓ Connexion à la base de données établie\n');
        
        // 1. Vérifier tous les giveaways
        console.log('--- Tous les giveaways ---');
        const allGiveaways = await db.query('SELECT * FROM giveaway ORDER BY id DESC');
        console.log(`Total: ${allGiveaways.length} giveaway(s)\n`);
        
        for (const g of allGiveaways) {
            console.log(`ID: ${g.id}`);
            console.log(`  Titre: ${g.titre}`);
            console.log(`  État: ${g.state}`);
            console.log(`  Date tirage: ${g.date_tirage || 'Non définie'}`);
            console.log(`  Gagnant: ${g.winner_twitch_id || 'Aucun'}`);
            console.log('');
        }
        
        // 2. Vérifier les giveaways actifs avec date
        console.log('--- Giveaways actifs avec date de tirage ---');
        const activeWithDate = await db.query(`
            SELECT * FROM giveaway 
            WHERE state = 'ouvert' 
            AND date_tirage IS NOT NULL
            ORDER BY date_tirage ASC
        `);
        console.log(`Total: ${activeWithDate.length} giveaway(s) actif(s) avec date\n`);
        
        for (const g of activeWithDate) {
            const dateTirage = new Date(g.date_tirage);
            const now = new Date();
            const diff = dateTirage - now;
            const isPast = diff < 0;
            
            console.log(`ID: ${g.id} - ${g.titre}`);
            console.log(`  Date de tirage: ${g.date_tirage}`);
            console.log(`  Maintenant: ${now.toISOString()}`);
            console.log(`  Statut: ${isPast ? '⚠️ PRÊT POUR TIRAGE' : '⏳ En attente'}`);
            if (!isPast) {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                console.log(`  Temps restant: ${hours}h ${minutes}m`);
            }
            console.log('');
        }
        
        // 3. Vérifier la requête utilisée par auto-draw
        console.log('--- Giveaways qui seraient tirés par auto-draw (MÉTHODE JAVASCRIPT) ---');
        const allActive = await db.query(`
            SELECT g.*, COUNT(p.user_id) as participant_count
            FROM giveaway g
            LEFT JOIN giveaway_participants p ON g.id = p.giveaway_id
            WHERE g.state = 'ouvert' 
            AND g.date_tirage IS NOT NULL
            GROUP BY g.id
        `);
        
        // Filtrer côté JavaScript comme dans le vrai code
        const now = new Date();
        const toDrawNow = allActive.filter(g => {
            const drawDate = new Date(g.date_tirage);
            return drawDate <= now;
        });
        
        console.log(`Total: ${toDrawNow.length} giveaway(s) à tirer maintenant\n`);
        
        for (const g of toDrawNow) {
            console.log(`🎲 ID: ${g.id} - ${g.titre}`);
            console.log(`   Participants: ${g.participant_count}`);
            console.log(`   Date tirage: ${g.date_tirage}`);
            console.log(`   Date tirage (objet): ${new Date(g.date_tirage)}`);
            console.log(`   Maintenant: ${now}`);
            console.log(`   Comparaison: ${new Date(g.date_tirage)} <= ${now} = ${new Date(g.date_tirage) <= now}`);
            
            // Vérifier les participants
            const participants = await db.getGiveawayParticipants(g.id);
            console.log(`   Liste participants:`);
            for (const p of participants) {
                console.log(`     - ${p.username} (${p.id_twitch})`);
            }
            console.log('');
        }
        
        // 4. Afficher l'heure du serveur MySQL
        console.log('--- Informations serveur ---');
        const serverTime = await db.query('SELECT NOW() as now_time, @@global.time_zone as tz_global, @@session.time_zone as tz_session');
        console.log(`Heure MySQL (locale): ${serverTime[0].now_time}`);
        console.log(`Fuseau horaire global: ${serverTime[0].tz_global}`);
        console.log(`Fuseau horaire session: ${serverTime[0].tz_session}`);
        console.log(`Heure Node.js (UTC): ${new Date().toISOString()}`);
        console.log(`Heure Node.js locale: ${new Date().toString()}`);
        console.log('');
        
    } catch (error) {
        console.error('❌ Erreur:', error);
    } finally {
        await db.close();
        console.log('\n=== FIN DU TEST ===');
    }
}

testAutoDraw();
