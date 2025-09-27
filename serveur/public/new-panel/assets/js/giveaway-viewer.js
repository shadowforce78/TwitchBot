// ==== GIVEAWAY VIEWER FUNCTIONALITY ====

let giveaways = [];
let currentGiveawayId = null;
let countdownIntervals = [];

// ==== INITIALIZATION ====
async function initializePage() {
    await loadGiveaways();
    await loadStats();
    
    // Auto-refresh every 30 seconds
    setInterval(loadGiveaways, 30000);
    setInterval(loadStats, 60000);
}

// ==== DATA LOADING ====
async function loadGiveaways() {
    try {
        showLoading('active-giveaways');
        showLoading('ended-giveaways');
        
        const data = await apiRequest('/api/giveaways');
        giveaways = data;
        
        displayActiveGiveaways();
        displayEndedGiveaways();
        
    } catch (error) {
        console.error('Erreur lors du chargement des giveaways:', error);
        showNotification('Erreur lors du chargement des giveaways', 'error');
        
        document.getElementById('active-giveaways').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3>Erreur de chargement</h3>
                <p>Impossible de charger les giveaways</p>
                <button class="btn btn-primary" onclick="loadGiveaways()">Réessayer</button>
            </div>
        `;
    }
}

async function loadStats() {
    try {
        const activeGiveaways = giveaways.filter(g => g.state === 'ouvert');
        const userParticipations = currentUser ? giveaways.filter(g => g.is_participating).length : 0;
        const totalParticipants = giveaways.reduce((sum, g) => sum + (g.participant_count || 0), 0);
        const totalPrizes = giveaways.reduce((sum, g) => sum + (g.cashprize || 0), 0);
        
        // Update stats display
        updateStat('active-giveaways-count', activeGiveaways.length);
        updateStat('total-participants', formatNumber(totalParticipants));
        updateStat('user-participations', userParticipations);
        updateStat('total-prizes', formatCurrency(totalPrizes));
        
    } catch (error) {
        console.error('Erreur lors du chargement des stats:', error);
    }
}

function updateStat(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

// ==== DISPLAY FUNCTIONS ====
function displayActiveGiveaways() {
    const container = document.getElementById('active-giveaways');
    const activeGiveaways = giveaways.filter(g => g.state === 'ouvert');
    
    if (activeGiveaways.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎁</div>
                <h3>Aucun giveaway actif</h3>
                <p>Il n'y a actuellement aucun giveaway en cours.<br>Revenez bientôt pour de nouveaux concours !</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = activeGiveaways.map(giveaway => createGiveawayCard(giveaway, true)).join('');
    
    // Start countdowns
    clearCountdowns();
    activeGiveaways.forEach(giveaway => {
        if (giveaway.date_tirage) {
            const interval = createCountdown(giveaway.date_tirage, `countdown-${giveaway.id}`);
            if (interval) {
                countdownIntervals.push(interval);
            }
        }
    });
}

function displayEndedGiveaways() {
    const container = document.getElementById('ended-giveaways');
    const endedGiveaways = giveaways.filter(g => g.state === 'ferme').slice(0, 6); // Show last 6
    
    if (endedGiveaways.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏁</div>
                <h3>Aucun giveaway terminé</h3>
                <p>Les giveaways terminés apparaîtront ici</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = endedGiveaways.map(giveaway => createGiveawayCard(giveaway, false)).join('');
}

function createGiveawayCard(giveaway, isActive) {
    const isParticipating = giveaway.is_participating;
    const participantCount = giveaway.participant_count || giveaway.nb_participants || 0;
    const maxParticipants = giveaway.max_participants || 999;
    const progressPercent = Math.min((participantCount / maxParticipants) * 100, 100);
    
    return `
        <div class="giveaway-card ${isParticipating ? 'participating' : ''} ${!isActive ? 'ended' : ''}" 
             onclick="${isActive ? `openGiveawayModal(${giveaway.id})` : ''}">
            
            <div class="giveaway-image">
                ${giveaway.image ? `<img src="${escapeHtml(giveaway.image)}" alt="${escapeHtml(giveaway.titre)}" />` : ''}
                <div class="giveaway-status">
                    <span class="status-badge ${isActive ? 'active' : 'ended'}">
                        ${isActive ? '🔥 Actif' : '🏁 Terminé'}
                    </span>
                </div>
                ${isParticipating ? '<div class="participation-indicator">✅</div>' : ''}
            </div>
            
            <div class="giveaway-content">
                <h3 class="giveaway-title">${escapeHtml(giveaway.titre || 'Giveaway sans titre')}</h3>
                
                <p class="giveaway-description">${escapeHtml(giveaway.description || 'Aucune description')}</p>
                
                ${giveaway.prix || giveaway.cashprize > 0 ? `
                    <div class="prize-info">
                        <div class="prize-title">🎁 Prix à gagner</div>
                        <div class="prize-value">
                            ${giveaway.prix ? escapeHtml(giveaway.prix) : ''}
                            ${giveaway.cashprize > 0 ? ` - ${formatCurrency(giveaway.cashprize)}` : ''}
                        </div>
                    </div>
                ` : ''}
                
                <div class="giveaway-details">
                    <div class="detail-item">
                        <span class="detail-icon">👥</span>
                        <span class="detail-value">${formatNumber(participantCount)}</span>
                        <span class="detail-label">participants</span>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-icon">🏆</span>
                        <span class="detail-value">${giveaway.nb_reward || 1}</span>
                        <span class="detail-label">gagnant${(giveaway.nb_reward || 1) > 1 ? 's' : ''}</span>
                    </div>
                    
                    <div class="detail-item">
                        <span class="detail-icon">📅</span>
                        <span class="detail-value">${formatDate(giveaway.created_at)}</span>
                        <span class="detail-label">créé</span>
                    </div>
                    
                    ${giveaway.date_tirage ? `
                        <div class="detail-item">
                            <span class="detail-icon">⏰</span>
                            <span class="detail-value">${formatDate(giveaway.date_tirage)}</span>
                            <span class="detail-label">tirage</span>
                        </div>
                    ` : ''}
                </div>
                
                ${maxParticipants < 999 ? `
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="progress-text">
                        <span>${participantCount} / ${maxParticipants}</span>
                        <span>${progressPercent.toFixed(1)}%</span>
                    </div>
                ` : ''}
                
                ${isActive && giveaway.date_tirage ? `
                    <div id="countdown-${giveaway.id}" class="countdown"></div>
                ` : ''}
                
                ${isActive ? `
                    <div class="giveaway-actions">
                        ${!isParticipating ? `
                            <button class="participate-btn" onclick="event.stopPropagation(); quickParticipate(${giveaway.id})">
                                ✅ Participer
                            </button>
                        ` : `
                            <button class="leave-btn" onclick="event.stopPropagation(); leaveGiveaway(${giveaway.id})">
                                ❌ Quitter
                            </button>
                        `}
                    </div>
                ` : ''}
                
                ${!isActive && giveaway.winner ? `
                    <div class="winner-info">
                        <div class="winner-label">🏆 Gagnant</div>
                        <div class="winner-name">${escapeHtml(giveaway.winner)}</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// ==== GIVEAWAY INTERACTIONS ====
function openGiveawayModal(giveawayId) {
    const giveaway = giveaways.find(g => g.id === giveawayId);
    if (!giveaway) return;
    
    currentGiveawayId = giveawayId;
    
    const modalInfo = document.getElementById('modal-giveaway-info');
    const requirementsList = document.getElementById('requirements-list');
    const participateBtn = document.getElementById('participate-btn');
    
    modalInfo.innerHTML = `
        ${giveaway.image ? `<img src="${escapeHtml(giveaway.image)}" alt="${escapeHtml(giveaway.titre)}" class="modal-giveaway-image" />` : ''}
        <h3>${escapeHtml(giveaway.titre)}</h3>
        <p>${escapeHtml(giveaway.description || 'Aucune description')}</p>
        
        ${giveaway.prix || giveaway.cashprize > 0 ? `
            <div class="prize-info">
                <div class="prize-title">🎁 Prix à gagner</div>
                <div class="prize-value">
                    ${giveaway.prix ? escapeHtml(giveaway.prix) : ''}
                    ${giveaway.cashprize > 0 ? ` - ${formatCurrency(giveaway.cashprize)}` : ''}
                </div>
            </div>
        ` : ''}
        
        <div class="giveaway-details">
            <div class="detail-item">
                <span class="detail-icon">👥</span>
                <span class="detail-value">${formatNumber(giveaway.participant_count || 0)}</span>
                <span class="detail-label">participants</span>
            </div>
            <div class="detail-item">
                <span class="detail-icon">🏆</span>
                <span class="detail-value">${giveaway.nb_reward || 1}</span>
                <span class="detail-label">gagnant${(giveaway.nb_reward || 1) > 1 ? 's' : ''}</span>
            </div>
        </div>
    `;
    
    // Default requirements
    const requirements = [
        'Être connecté avec votre compte Twitch',
        'Respecter les règles de la communauté',
        'Avoir plus de 18 ans ou accord parental'
    ];
    
    requirementsList.innerHTML = requirements.map(req => `<li>${escapeHtml(req)}</li>`).join('');
    
    // Update participate button
    if (giveaway.is_participating) {
        participateBtn.textContent = '❌ Se désinscrire';
        participateBtn.className = 'btn btn-error';
    } else {
        participateBtn.textContent = '✅ Participer';
        participateBtn.className = 'btn btn-primary';
    }
    
    openModal('participation-modal');
}

async function participateInGiveaway() {
    if (!currentUser) {
        showNotification('Veuillez vous connecter pour participer', 'warning');
        return;
    }
    
    if (!currentGiveawayId) return;
    
    const giveaway = giveaways.find(g => g.id === currentGiveawayId);
    if (!giveaway) return;
    
    try {
        if (giveaway.is_participating) {
            // Leave giveaway
            await apiRequest(`/api/giveaways/${currentGiveawayId}/participate`, {
                method: 'DELETE'
            });
            
            showNotification('Vous avez quitté le giveaway', 'info');
        } else {
            // Join giveaway
            await apiRequest(`/api/giveaways/${currentGiveawayId}/participate`, {
                method: 'POST'
            });
            
            showNotification('Participation enregistrée avec succès !', 'success');
        }
        
        closeModal();
        await loadGiveaways();
        
    } catch (error) {
        console.error('Erreur lors de la participation:', error);
        showNotification('Erreur lors de la participation', 'error');
    }
}

async function quickParticipate(giveawayId) {
    if (!currentUser) {
        showNotification('Veuillez vous connecter pour participer', 'warning');
        return;
    }
    
    try {
        await apiRequest(`/api/giveaways/${giveawayId}/participate`, {
            method: 'POST'
        });
        
        showNotification('Participation enregistrée !', 'success');
        await loadGiveaways();
        
    } catch (error) {
        console.error('Erreur lors de la participation:', error);
        showNotification('Erreur lors de la participation', 'error');
    }
}

async function leaveGiveaway(giveawayId) {
    if (!confirm('Êtes-vous sûr de vouloir quitter ce giveaway ?')) {
        return;
    }
    
    try {
        await apiRequest(`/api/giveaways/${giveawayId}/participate`, {
            method: 'DELETE'
        });
        
        showNotification('Vous avez quitté le giveaway', 'info');
        await loadGiveaways();
        
    } catch (error) {
        console.error('Erreur lors de la désinscription:', error);
        showNotification('Erreur lors de la désinscription', 'error');
    }
}

// ==== UTILITY FUNCTIONS ====
function refreshGiveaways() {
    loadGiveaways();
    showNotification('Actualisation en cours...', 'info', 2000);
}

function clearCountdowns() {
    countdownIntervals.forEach(interval => clearInterval(interval));
    countdownIntervals = [];
}

// ==== CLEANUP ====
window.addEventListener('beforeunload', () => {
    clearCountdowns();
});

// Make functions available globally
window.openGiveawayModal = openGiveawayModal;
window.participateInGiveaway = participateInGiveaway;
window.quickParticipate = quickParticipate;
window.leaveGiveaway = leaveGiveaway;
window.refreshGiveaways = refreshGiveaways;

// Initialize page when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Page giveaways chargée');
    
    // Check authentication first
    await checkAuth();
    
    // Then load giveaways data
    await initializePage();
});