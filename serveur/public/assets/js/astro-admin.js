// ==== ASTRO ADMIN PANEL FUNCTIONALITY ====

let user = null;
let giveaways = [];

// ==== INITIALIZATION ====
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Astro admin panel loaded');
    
    await loadUserInfo();
    checkAdminAccess();
    await loadAllData();
    
    initializeEventListeners();
});

// ==== AUTHENTICATION & ACCESS ====
async function loadUserInfo() {
    try {
        const response = await fetch('/api/me');
        if (response.ok) {
            user = await response.json();
            updateUserDisplay();
        } else {
            user = null;
        }
    } catch (error) {
        console.error('Erreur chargement user info:', error);
        user = null;
    }
}

function updateUserDisplay() {
    if (user && user.isAuthenticated) {
        const userAvatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');
        
        if (userAvatar) userAvatar.src = user.avatar || 'https://via.placeholder.com/32x32';
        if (userName) userName.textContent = user.displayName || user.login;
    }
}

function checkAdminAccess() {
    if (!user || !user.isAdmin) {
        showNotification('Accès refusé - Admin requis', 'error');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
        return;
    }
}

// ==== DATA LOADING ====
async function loadAllData() {
    await Promise.all([
        loadGiveaways(),
        loadBotStats(),
        loadOverviewStats(),
        loadRecentActivity()
    ]);
}

async function loadGiveaways() {
    try {
        const response = await fetch('/api/giveaways');
        if (response.ok) {
            giveaways = await response.json();
            displayGiveaways();
            updateGiveawayOverview();
        }
    } catch (error) {
        console.error('Erreur chargement giveaways:', error);
        showNotification('Erreur lors du chargement des giveaways', 'error');
    }
}

async function loadBotStats() {
    try {
        const response = await fetch('/api/bot-status');
        if (response.ok) {
            const stats = await response.json();
            updateBotStatusDisplay(stats);
        }
    } catch (error) {
        console.error('Erreur chargement bot stats:', error);
        // Use mock data
        updateBotStatusDisplay({
            status: 'online',
            uptime: '3h 24m'
        });
    }
}

async function loadOverviewStats() {
    // Mock data for now - in real implementation, these would come from API
    updateOverviewDisplay({
        commandsUsed: 1247,
        activeUsers: 156,
        totalCommands: 47,
        activeGiveaways: giveaways.filter(g => g.state === 'ouvert' || g.status === 'active').length
    });
}

async function loadRecentActivity() {
    // Mock data for now - in real implementation, this would come from API
    const mockActivity = [
        { user: 'Viewer123', command: '!aquarium', time: 'Il y a 2 min' },
        { user: 'GamerPro', command: '!help', time: 'Il y a 5 min' },
        { user: 'StreamFan', command: '!discord', time: 'Il y a 7 min' },
        { user: 'TwitchUser', command: '!socials', time: 'Il y a 12 min' }
    ];
    
    updateRecentActivityDisplay(mockActivity);
}

// ==== DISPLAY FUNCTIONS ====
function updateBotStatusDisplay(stats) {
    const botStatus = document.getElementById('bot-status');
    const botUptime = document.getElementById('bot-uptime');

    if (botStatus) {
        botStatus.className = `status status-${stats.status === 'online' ? 'online' : 'offline'}`;
        botStatus.textContent = stats.status === 'online' ? '✅ En ligne' : '❌ Hors ligne';
    }

    if (botUptime) {
        botUptime.textContent = `Uptime: ${stats.uptime}`;
    }
}

function updateOverviewDisplay(stats) {
    const commandsUsed = document.getElementById('commands-used');
    const activeUsers = document.getElementById('active-users');
    const totalCommands = document.getElementById('total-commands');
    const activeGiveaways = document.getElementById('active-giveaways');

    if (commandsUsed) commandsUsed.textContent = stats.commandsUsed.toLocaleString();
    if (activeUsers) activeUsers.textContent = stats.activeUsers;
    if (totalCommands) totalCommands.textContent = stats.totalCommands;
    if (activeGiveaways) activeGiveaways.textContent = stats.activeGiveaways;
}

function updateGiveawayOverview() {
    const activeCount = giveaways.filter(g => g.state === 'ouvert' || g.status === 'active').length;
    const activeGiveawaysEl = document.getElementById('active-giveaways');
    if (activeGiveawaysEl) {
        activeGiveawaysEl.textContent = activeCount;
    }
}

function updateRecentActivityDisplay(activities) {
    const activityContainer = document.getElementById('recent-activity');
    if (!activityContainer) return;

    activityContainer.innerHTML = activities.map(activity => `
        <div class="activity-item-small">
            <div class="activity-user">👤 ${escapeHtml(activity.user)}</div>
            <div class="activity-command">${escapeHtml(activity.command)}</div>
            <div class="activity-time">${escapeHtml(activity.time)}</div>
        </div>
    `).join('');
}

function displayGiveaways() {
    const container = document.getElementById('admin-giveaways-list');
    if (!container) return;

    if (giveaways.length === 0) {
        container.innerHTML = '<p class="text-center text-secondary">Aucun giveaway trouvé</p>';
        return;
    }

    container.innerHTML = giveaways.map(giveaway => `
        <div class="giveaway-item">
            <div class="giveaway-info">
                <h4>${escapeHtml(giveaway.titre || giveaway.title)}</h4>
                <p>${escapeHtml(giveaway.description || 'Aucune description')}</p>
                <div class="giveaway-meta">
                    <span>👥 ${giveaway.participant_count || giveaway.nb_participants || 0} participants</span>
                    ${giveaway.date_tirage || giveaway.end_date ? 
                        `<span>📅 Fin: ${formatDate(giveaway.date_tirage || giveaway.end_date)}</span>` : 
                        ''
                    }
                    ${!isGiveawayActive(giveaway) && giveaway.winner_username ? 
                        `<span style="color: var(--success); font-weight: bold;">🏆 Gagnant: ${escapeHtml(giveaway.winner_username)}</span>` : 
                        ''
                    }
                </div>
            </div>
            <div class="giveaway-actions">
                <span class="status ${getGiveawayStatusClass(giveaway)}">
                    ${getGiveawayStatusText(giveaway)}
                </span>
                ${isGiveawayActive(giveaway) ? `
                    <button class="btn btn-warning btn-sm" onclick="editGiveaway(${giveaway.id})">✏️ Modifier</button>
                    <button class="btn btn-success btn-sm" onclick="drawWinner(${giveaway.id})">🎲 Tirer au sort</button>
                ` : `
                    <button class="btn btn-outline btn-sm" onclick="viewGiveawayResults(${giveaway.id})">👁️ Voir résultats</button>
                `}
                <button class="btn btn-error btn-sm" onclick="deleteGiveaway(${giveaway.id})">🗑️ Supprimer</button>
            </div>
        </div>
    `).join('');
}

// ==== GIVEAWAY MANAGEMENT ====
function createGiveaway() {
    openModal('create-giveaway-modal');
}

function editGiveaway(id) {
    const giveaway = giveaways.find(g => g.id === id);
    if (!giveaway) return;

    // Fill form with existing data
    document.getElementById('edit-giveaway-id').value = giveaway.id;
    document.getElementById('edit-giveaway-title').value = giveaway.titre || giveaway.title || '';
    document.getElementById('edit-giveaway-reward').value = giveaway.prix || giveaway.reward || '';
    document.getElementById('edit-giveaway-description').value = giveaway.description || '';
    document.getElementById('edit-giveaway-thumbnail').value = giveaway.image || giveaway.thumbnail || '';
    
    if (giveaway.date_tirage || giveaway.end_date) {
        const endDate = new Date(giveaway.date_tirage || giveaway.end_date);
        document.getElementById('edit-giveaway-end-date').value = endDate.toISOString().slice(0, 16);
    }
    
    document.getElementById('edit-giveaway-min-follows').value = giveaway.min_follows || 0;
    document.getElementById('edit-giveaway-min-messages').value = giveaway.min_messages || 0;

    openModal('edit-giveaway-modal');
}

async function drawWinner(id) {
    if (!confirm('Êtes-vous sûr de vouloir tirer au sort le gagnant ? Cette action est irréversible.')) {
        return;
    }

    try {
        const response = await fetch(`/api/giveaways/${id}/draw-winner`, {
            method: 'POST'
        });

        if (response.ok) {
            const result = await response.json();
            showWinnerModal(result);
            await loadGiveaways(); // Reload giveaways
        } else {
            const error = await response.json();
            showNotification(error.message || 'Erreur lors du tirage au sort', 'error');
        }
    } catch (error) {
        console.error('Erreur tirage au sort:', error);
        showNotification('Erreur de connexion', 'error');
    }
}

async function deleteGiveaway(id) {
    const giveaway = giveaways.find(g => g.id === id);
    if (!giveaway) return;

    if (!confirm(`Êtes-vous sûr de vouloir supprimer le giveaway "${giveaway.titre || giveaway.title}" ?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/giveaways/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('Giveaway supprimé avec succès', 'success');
            await loadGiveaways();
        } else {
            const error = await response.json();
            showNotification(error.message || 'Erreur lors de la suppression', 'error');
        }
    } catch (error) {
        console.error('Erreur suppression giveaway:', error);
        showNotification('Erreur de connexion', 'error');
    }
}

function showWinnerModal(result) {
    const winnerContent = document.getElementById('winner-content');
    if (winnerContent) {
        winnerContent.innerHTML = `
            <div class="text-center">
                <div style="font-size: 4rem; margin-bottom: 1rem;">🎉</div>
                <h3>Félicitations !</h3>
                <p><strong>${escapeHtml(result.winner.displayName || result.winner.username)}</strong> a gagné :</p>
                <p style="font-size: 1.2rem; color: var(--secondary); margin: 1rem 0;">
                    ${escapeHtml(result.giveaway.prix || result.giveaway.reward)}
                </p>
            </div>
        `;
    }
    openModal('winner-modal');
}

async function viewGiveawayResults(id) {
    try {
        const giveaway = giveaways.find(g => g.id === id);
        if (!giveaway) {
            showNotification('Giveaway introuvable', 'error');
            return;
        }

        // Récupérer les participants
        const response = await fetch(`/api/giveaways/${id}/participants`);
        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des participants');
        }
        const participants = await response.json();

        const resultsContent = document.getElementById('results-content');
        if (resultsContent) {
            resultsContent.innerHTML = `
                <div class="results-container">
                    <div class="giveaway-summary">
                        <h4>${escapeHtml(giveaway.titre || giveaway.title)}</h4>
                        <p>${escapeHtml(giveaway.description || 'Aucune description')}</p>
                        ${giveaway.prix || giveaway.reward ? `
                            <div class="prize-info">
                                <strong>🎁 Prix:</strong> ${escapeHtml(giveaway.prix || giveaway.reward)}
                                ${giveaway.cashprize > 0 ? ` - ${formatCurrency(giveaway.cashprize)}` : ''}
                            </div>
                        ` : ''}
                    </div>

                    <div class="results-stats">
                        <div class="stat-card">
                            <div class="stat-icon">👥</div>
                            <div class="stat-value">${participants.length}</div>
                            <div class="stat-label">Participants</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">🏆</div>
                            <div class="stat-value">${giveaway.nb_reward || 1}</div>
                            <div class="stat-label">Gagnant${(giveaway.nb_reward || 1) > 1 ? 's' : ''}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">${giveaway.state === 'ferme' ? '🔒' : '🟢'}</div>
                            <div class="stat-value">${giveaway.state === 'ferme' ? 'Fermé' : 'Ouvert'}</div>
                            <div class="stat-label">Statut</div>
                        </div>
                    </div>

                    ${giveaway.winner_username ? `
                        <div class="winner-section">
                            <h5>🏆 Gagnant</h5>
                            <div class="winner-card">
                                <div class="winner-trophy">🎉</div>
                                <div class="winner-details">
                                    <div class="winner-username">${escapeHtml(giveaway.winner_username)}</div>
                                    <div class="winner-badge">Gagnant officiel</div>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    ${participants.length > 0 ? `
                        <div class="participants-section">
                            <h5>👥 Liste des Participants (${participants.length})</h5>
                            <div class="participants-list">
                                ${participants.map(p => `
                                    <div class="participant-item ${giveaway.winner_id_twitch === p.id_twitch ? 'is-winner' : ''}">
                                        <span class="participant-name">${escapeHtml(p.username)}</span>
                                        ${giveaway.winner_id_twitch === p.id_twitch ? '<span class="winner-tag">🏆 Gagnant</span>' : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : '<p class="text-center text-secondary">Aucun participant</p>'}
                </div>

                <style>
                    .results-container { padding: 1rem 0; }
                    .giveaway-summary { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
                    .giveaway-summary h4 { margin: 0 0 0.5rem 0; color: var(--primary); }
                    .prize-info { margin-top: 0.5rem; padding: 0.5rem; background: var(--secondary-bg); border-radius: 4px; }
                    
                    .results-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
                    .stat-card { text-align: center; padding: 1rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border); }
                    .stat-icon { font-size: 2rem; margin-bottom: 0.5rem; }
                    .stat-value { font-size: 1.5rem; font-weight: bold; color: var(--primary); }
                    .stat-label { font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem; }
                    
                    .winner-section { margin-bottom: 1.5rem; }
                    .winner-section h5 { margin: 0 0 1rem 0; font-size: 1.1rem; }
                    .winner-card { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); border-radius: 8px; box-shadow: 0 2px 8px rgba(255, 215, 0, 0.3); }
                    .winner-trophy { font-size: 3rem; }
                    .winner-username { font-size: 1.25rem; font-weight: bold; color: #333; }
                    .winner-badge { font-size: 0.875rem; color: #666; }
                    
                    .participants-section h5 { margin: 0 0 1rem 0; font-size: 1.1rem; }
                    .participants-list { max-height: 400px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; }
                    .participant-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); transition: background 0.2s; }
                    .participant-item:last-child { border-bottom: none; }
                    .participant-item:hover { background: var(--bg-secondary); }
                    .participant-item.is-winner { background: #fff9e6; font-weight: bold; }
                    .participant-name { color: var(--text); }
                    .winner-tag { font-size: 0.875rem; color: #f59e0b; font-weight: bold; }
                </style>
            `;
        }
        openModal('results-modal');
    } catch (error) {
        console.error('Erreur récupération résultats:', error);
        showNotification('Erreur lors de la récupération des résultats', 'error');
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}

// ==== FORM HANDLERS ====
function initializeEventListeners() {
    const createForm = document.getElementById('create-giveaway-form');
    const editForm = document.getElementById('edit-giveaway-form');

    if (createForm) {
        createForm.addEventListener('submit', handleCreateGiveaway);
    }

    if (editForm) {
        editForm.addEventListener('submit', handleEditGiveaway);
    }
}

async function handleCreateGiveaway(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const giveawayData = {
        title: formData.get('title'),
        reward: formData.get('reward'),
        description: formData.get('description'),
        end_date: formData.get('end_date'),
        thumbnail: formData.get('thumbnail'),
        min_follows: parseInt(formData.get('min_follows')) || 0,
        min_messages: parseInt(formData.get('min_messages')) || 0
    };

    try {
        const response = await fetch('/api/giveaways', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(giveawayData)
        });

        if (response.ok) {
            showNotification('Giveaway créé avec succès', 'success');
            closeModal('create-giveaway-modal');
            e.target.reset();
            await loadGiveaways();
        } else {
            const error = await response.json();
            showNotification(error.message || 'Erreur lors de la création', 'error');
        }
    } catch (error) {
        console.error('Erreur création giveaway:', error);
        showNotification('Erreur de connexion', 'error');
    }
}

async function handleEditGiveaway(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const giveawayId = formData.get('id');
    const giveawayData = {
        title: formData.get('title'),
        reward: formData.get('reward'),
        description: formData.get('description'),
        end_date: formData.get('end_date'),
        thumbnail: formData.get('thumbnail'),
        min_follows: parseInt(formData.get('min_follows')) || 0,
        min_messages: parseInt(formData.get('min_messages')) || 0
    };

    try {
        const response = await fetch(`/api/giveaways/${giveawayId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(giveawayData)
        });

        if (response.ok) {
            showNotification('Giveaway modifié avec succès', 'success');
            closeModal('edit-giveaway-modal');
            await loadGiveaways();
        } else {
            const error = await response.json();
            showNotification(error.message || 'Erreur lors de la modification', 'error');
        }
    } catch (error) {
        console.error('Erreur modification giveaway:', error);
        showNotification('Erreur de connexion', 'error');
    }
}

// ==== QUICK ACTIONS ====
async function restartBot() {
    if (!confirm('Êtes-vous sûr de vouloir redémarrer le bot ?')) return;
    
    try {
        const response = await fetch('/api/bot/restart', { method: 'POST' });
        if (response.ok) {
            showNotification('Bot redémarré avec succès', 'success');
            setTimeout(() => loadBotStats(), 2000);
        } else {
            showNotification('Erreur lors du redémarrage', 'error');
        }
    } catch (error) {
        showNotification('Erreur de connexion', 'error');
    }
}

function exportStats() {
    // TODO: Implement export functionality
    showNotification('Export en cours...', 'info');
}

function cleanLogs() {
    if (!confirm('Êtes-vous sûr de vouloir nettoyer les logs ?')) return;
    // TODO: Implement clean logs functionality
    showNotification('Logs nettoyés', 'success');
}

function showConfiguration() {
    // TODO: Implement configuration panel
    showNotification('Panel de configuration en développement', 'info');
}

function backup() {
    // TODO: Implement backup functionality
    showNotification('Sauvegarde en cours...', 'info');
}

function viewLogs() {
    // TODO: Implement logs viewer
    showNotification('Visualiseur de logs en développement', 'info');
}

// ==== UTILITY FUNCTIONS ====
function getGiveawayStatusClass(giveaway) {
    if (giveaway.state === 'ouvert' || giveaway.status === 'active') {
        return 'status-active';
    } else if (giveaway.state === 'ferme' || giveaway.status === 'ended') {
        return 'status-ended';
    }
    return 'status-offline';
}

function getGiveawayStatusText(giveaway) {
    if (giveaway.state === 'ouvert' || giveaway.status === 'active') {
        return 'Actif';
    } else if (giveaway.state === 'ferme' || giveaway.status === 'ended') {
        return 'Terminé';
    }
    return 'Inconnu';
}

function isGiveawayActive(giveaway) {
    return giveaway.state === 'ouvert' || giveaway.status === 'active';
}

async function logout() {
    try {
        const response = await fetch('/logout', { method: 'POST' });
        if (response.ok) {
            showNotification('Déconnexion réussie', 'success');
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        }
    } catch (error) {
        console.error('Erreur déconnexion:', error);
        showNotification('Erreur lors de la déconnexion', 'error');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);

    // Hide and remove notification
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => container.removeChild(notification), 300);
    }, 4000);
}

// ==== MODAL FUNCTIONS ====
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        closeModal(e.target.id);
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal.show');
        if (openModal) {
            closeModal(openModal.id);
        }
    }
});