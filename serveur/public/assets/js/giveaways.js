// Giveaways Page JavaScript

// Charger les giveaways actifs
async function loadActiveGiveaways() {
    try {
        const response = await fetch('/api/giveaways');
        if (!response.ok) throw new Error('Erreur lors du chargement');
        
        const giveaways = await response.json();
        const activeGiveaways = giveaways.filter(g => g.state === 'ouvert' || g.status === 'active');
        
        displayActiveGiveaways(activeGiveaways);
    } catch (error) {
        console.error('Erreur:', error);
        document.getElementById('active-giveaways').innerHTML = '<p class="text-center">Erreur lors du chargement des giveaways</p>';
    }
}

function displayActiveGiveaways(giveaways) {
    const container = document.getElementById('active-giveaways');
    
    if (giveaways.length === 0) {
        container.innerHTML = '<p class="text-center">Aucun giveaway en cours pour le moment. Revenez bientôt !</p>';
        return;
    }
    
    container.innerHTML = giveaways.map(g => {
        const hasParticipated = g.is_participating || false;
        
        return `
            <div class="giveaway-card-large">
                ${g.image || g.thumbnail ? `
                    <img src="${g.image || g.thumbnail}" alt="${escapeHtml(g.titre || g.title)}" class="giveaway-image">
                ` : ''}
                
                <h3 class="giveaway-title">${escapeHtml(g.titre || g.title || 'Sans titre')}</h3>
                
                ${g.prix || g.reward ? `
                    <span class="giveaway-reward">🎁 ${escapeHtml(g.prix || g.reward)}</span>
                ` : ''}
                
                <div class="giveaway-meta">
                    <span>👥 ${g.participant_count || 0} participant(s)</span>
                    ${g.date_tirage || g.end_date ? `
                        <span>📅 Fin : ${formatDate(g.date_tirage || g.end_date)}</span>
                    ` : ''}
                </div>
                
                ${g.description ? `
                    <p class="giveaway-description">${escapeHtml(g.description)}</p>
                ` : ''}
                
                <div class="giveaway-actions">
                    ${hasParticipated ? `
                        <button class="btn btn-success" disabled>
                            ✓ Participé
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="leaveGiveaway(${g.id})">
                            ✕ Se désinscrire
                        </button>
                    ` : `
                        <button class="btn btn-primary" onclick="participateInGiveaway(${g.id})">
                            🎁 Participer
                        </button>
                    `}
                </div>
                
                <button class="more-info-toggle" onclick="toggleMoreInfo(this)">
                    <span>En savoir plus sur les conditions</span>
                    <span>▼</span>
                </button>
                <div class="more-info-content">
                    <h4>📋 Conditions de participation :</h4>
                    <ul>
                        <li>Être connecté avec un compte Twitch</li>
                        ${g.min_follows > 0 ? `<li>Être abonné depuis au moins ${g.min_follows} jour(s)</li>` : ''}
                        ${g.min_messages > 0 ? `<li>Avoir envoyé au moins ${g.min_messages} message(s) dans le chat</li>` : ''}
                        <li>Respecter les règles de la communauté</li>
                    </ul>
                    <h4>🎲 Comment se déroule le tirage ?</h4>
                    <p>Le gagnant est sélectionné aléatoirement parmi tous les participants à la date et heure indiquées. Chaque participant a exactement les mêmes chances de gagner.</p>
                </div>
            </div>
        `;
    }).join('');
}

function toggleMoreInfo(button) {
    const content = button.nextElementSibling;
    const icon = button.querySelector('span:last-child');
    
    content.classList.toggle('active');
    icon.textContent = content.classList.contains('active') ? '▲' : '▼';
}

// Charger l'historique
async function loadHistoryGiveaways() {
    try {
        const response = await fetch('/api/giveaways');
        if (!response.ok) throw new Error('Erreur lors du chargement');
        
        const giveaways = await response.json();
        const endedGiveaways = giveaways
            .filter(g => g.state === 'ferme' || g.status === 'ended')
            .sort((a, b) => new Date(b.date_tirage || b.end_date) - new Date(a.date_tirage || a.end_date));
        
        displayHistoryGiveaways(endedGiveaways);
    } catch (error) {
        console.error('Erreur:', error);
        document.getElementById('history-giveaways').innerHTML = '<p class="text-center">Erreur lors du chargement de l\'historique</p>';
    }
}

function displayHistoryGiveaways(giveaways) {
    const container = document.getElementById('history-giveaways');
    
    if (giveaways.length === 0) {
        container.innerHTML = '<p class="text-center">Aucun giveaway dans l\'historique</p>';
        return;
    }
    
    container.innerHTML = giveaways.map(g => `
        <div class="history-card">
            <div class="history-card-header">
                <h3 class="history-card-title">${escapeHtml(g.titre || g.title || 'Sans titre')}</h3>
                <p class="history-card-reward">${escapeHtml(g.prix || g.reward || 'Prix mystère')}</p>
            </div>
            <div class="history-card-body">
                <div class="history-info">
                    <span>📅</span>
                    <span>${formatDate(g.date_tirage || g.end_date)}</span>
                </div>
                <div class="history-info">
                    <span>👥</span>
                    <span>${g.participant_count || 0} participant(s)</span>
                </div>
                ${g.winner_username ? `
                    <div class="winner-badge">
                        <span>🏆</span>
                        <span>${escapeHtml(g.winner_username)}</span>
                    </div>
                ` : '<p style="color: var(--text-secondary);">Aucun gagnant</p>'}
            </div>
        </div>
    `).join('');
}

// Participer à un giveaway
async function participateInGiveaway(giveawayId) {
    try {
        const response = await fetch(`/api/giveaways/${giveawayId}/participate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Participation enregistrée avec succès ! 🎉', 'success');
            // Recharger les giveaways pour mettre à jour l'interface
            await loadActiveGiveaways();
        } else {
            showNotification(data.message || 'Erreur lors de la participation', 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur de connexion', 'error');
    }
}

// Se désinscrire d'un giveaway
async function leaveGiveaway(giveawayId) {
    // Demander confirmation
    if (!confirm('Êtes-vous sûr de vouloir vous désinscrire de ce giveaway ?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/giveaways/${giveawayId}/leave`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Vous avez quitté le giveaway', 'info');
            // Recharger les giveaways pour mettre à jour l'interface
            await loadActiveGiveaways();
        } else {
            showNotification(data.message || 'Erreur lors de la désinscription', 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur de connexion', 'error');
    }
}

// handleLogout() et submitSuggestion() sont définis dans common.js

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    loadActiveGiveaways();
    loadHistoryGiveaways();
    checkAuth();
});
