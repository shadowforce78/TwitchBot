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
            ${giveaway.image && giveaway.image.trim() ? 
                `<div class="giveaway-thumbnail">
                    <img src="${escapeHtml(giveaway.image)}" alt="${escapeHtml(giveaway.titre || giveaway.title)}" loading="lazy">
                </div>` : 
                `<div class="giveaway-icon">🎁</div>`
            }
            <div class="giveaway-info">
                <h4>${escapeHtml(giveaway.titre || giveaway.title)}</h4>
                <p>${escapeHtml(giveaway.description || 'Aucune description')}</p>
                <div class="giveaway-meta">
                    <span>👥 ${giveaway.participant_count || giveaway.nb_participants || 0} participants</span>
                    ${giveaway.date_tirage || giveaway.end_date ? 
                        `<span>📅 Fin: ${formatDate(giveaway.date_tirage || giveaway.end_date)}</span>` : 
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
                    ${(giveaway.state === 'ferme' || giveaway.status === 'ended') && giveaway.winner_twitch_id ? `
                        <button class="btn btn-secondary btn-sm" onclick="rerollWinner(${giveaway.id})">🔄 Retirer au sort</button>
                    ` : ''}
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
        // MySQL renvoie la date en UTC, on doit la convertir en heure locale pour l'input datetime-local
        const endDate = new Date(giveaway.date_tirage || giveaway.end_date);
        // Convertir UTC vers heure locale pour l'affichage
        const year = endDate.getFullYear();
        const month = String(endDate.getMonth() + 1).padStart(2, '0');
        const day = String(endDate.getDate()).padStart(2, '0');
        const hours = String(endDate.getHours()).padStart(2, '0');
        const minutes = String(endDate.getMinutes()).padStart(2, '0');
        document.getElementById('edit-giveaway-end-date').value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }

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

async function rerollWinner(id) {
    if (!confirm('Êtes-vous sûr de vouloir retirer au sort un nouveau gagnant ? L\'ancien gagnant sera remplacé.')) {
        return;
    }

    try {
        const response = await fetch(`/api/giveaways/${id}/reroll-winner`, {
            method: 'POST'
        });

        if (response.ok) {
            const result = await response.json();
            showWinnerModal(result, true);
            await loadGiveaways(); // Reload giveaways
        } else {
            const error = await response.json();
            showNotification(error.message || 'Erreur lors du reroll', 'error');
        }
    } catch (error) {
        console.error('Erreur reroll:', error);
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

function showWinnerModal(result, isReroll = false) {
    const winnerContent = document.getElementById('winner-content');
    if (winnerContent) {
        winnerContent.innerHTML = `
            <div class="text-center">
                <div style="font-size: 4rem; margin-bottom: 1rem;">🎉</div>
                <h3>${isReroll ? 'Nouveau gagnant !' : 'Félicitations !'}</h3>
                ${isReroll ? '<p style="color: var(--warning); margin-bottom: 1rem;">Un nouveau gagnant a été tiré au sort</p>' : ''}
                <p><strong>${escapeHtml(result.winner.displayName || result.winner.username)}</strong> a gagné :</p>
                <p style="font-size: 1.2rem; color: var(--secondary); margin: 1rem 0;">
                    ${escapeHtml(result.giveaway.prix || result.giveaway.reward)}
                </p>
                
            </div>
        `;
    }
    openModal('winner-modal');
}

function viewGiveawayResults(id) {
    const giveaway = giveaways.find(g => g.id === id);
    if (!giveaway) return;

    // Display giveaway results
    const resultsContent = document.getElementById('results-content');
    if (resultsContent) {
        resultsContent.innerHTML = `
            <h4>Résultats du giveaway "${escapeHtml(giveaway.titre || giveaway.title)}"</h4>
            <p><strong>Gagnant :</strong> ${escapeHtml(giveaway.winner_username || 'Inconnu')}</p>
            <p><strong>Récompense :</strong> ${escapeHtml(giveaway.prix || giveaway.reward || 'Aucune')}</p>
        `;
    }
    openModal('results-modal');
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
    
    // Convertir la date locale en UTC pour MySQL
    let endDate = formData.get('end_date');
    if (endDate) {
        // datetime-local renvoie "YYYY-MM-DDTHH:MM", on le convertit en ISO UTC
        const localDate = new Date(endDate);
        endDate = localDate.toISOString().slice(0, 19).replace('T', ' ');
    }
    
    const giveawayData = {
        title: formData.get('title'),
        reward: formData.get('reward'),
        description: formData.get('description'),
        end_date: endDate,
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
    
    // Convertir la date locale en UTC pour MySQL
    let endDate = formData.get('end_date');
    if (endDate) {
        // datetime-local renvoie "YYYY-MM-DDTHH:MM", on le convertit en ISO UTC
        const localDate = new Date(endDate);
        endDate = localDate.toISOString().slice(0, 19).replace('T', ' ');
    }
    
    const giveawayData = {
        title: formData.get('title'),
        reward: formData.get('reward'),
        description: formData.get('description'),
        end_date: endDate,
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
async function checkAutoDraw() {
    try {
        showNotification('Vérification du système auto-draw...', 'info');
        const response = await fetch('/api/giveaways/check-auto-draw', { 
            method: 'POST' 
        });
        
        if (response.ok) {
            showNotification('Vérification terminée - Consultez la console serveur', 'success');
            await loadGiveaways(); // Reload giveaways
        } else {
            showNotification('Erreur lors de la vérification', 'error');
        }
    } catch (error) {
        console.error('Erreur vérification auto-draw:', error);
        showNotification('Erreur de connexion', 'error');
    }
}

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

// ==== BOT COMMANDS MANAGEMENT ====
let commands = [];

async function loadCommands() {
    try {
        const response = await fetch('/api/commands');
        if (response.ok) {
            commands = await response.json();
            displayCommands();
        } else {
            showNotification('Erreur lors du chargement des commandes', 'error');
        }
    } catch (error) {
        console.error('Erreur chargement commandes:', error);
        showNotification('Erreur de connexion', 'error');
    }
}

function displayCommands() {
    const container = document.getElementById('commands-list');
    
    if (!commands || commands.length === 0) {
        container.innerHTML = '<p class="text-center text-secondary">Aucune commande disponible</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="commands-grid">
            ${commands.map(cmd => `
                <div class="command-card ${!cmd.enabled ? 'disabled' : ''}">
                    <div class="command-header">
                        <div class="command-info">
                            <span class="command-name">!${escapeHtml(cmd.name)}</span>
                            <span class="command-type ${cmd.type || 'basic'}">${getCommandTypeLabel(cmd.type)}</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                ${cmd.enabled ? 'checked' : ''} 
                                onchange="toggleCommand('${escapeHtml(cmd.name)}')"
                                ${cmd.name === 'command' ? 'disabled' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <p class="command-description">${escapeHtml(cmd.description || 'Aucune description')}</p>
                    ${cmd.content ? `
                        <div class="command-content">
                            <small>Réponse : </small>
                            <code>${escapeHtml(cmd.content.substring(0, 100))}${cmd.content.length > 100 ? '...' : ''}</code>
                        </div>
                    ` : ''}
                    <div class="command-footer">
                        <span class="command-status ${cmd.enabled ? 'active' : 'inactive'}">
                            ${cmd.enabled ? '✓ Active' : '✕ Désactivée'}
                        </span>
                        ${cmd.name === 'command' ? '<small style="color: var(--warning);">⚠️ Protégée</small>' : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function getCommandTypeLabel(type) {
    const types = {
        'basic': '📝 Basique',
        'interactive': '🎮 Interactive',
        'moderation': '🛡️ Modération',
        'info': 'ℹ️ Info',
        'fun': '🎉 Fun',
        'utility': '🔧 Utilitaire'
    };
    return types[type] || '📝 Basique';
}

async function toggleCommand(commandName) {
    try {
        const response = await fetch(`/api/commands/${commandName}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Mettre à jour l'état local
            const cmd = commands.find(c => c.name === commandName);
            if (cmd) {
                cmd.enabled = data.enabled;
            }
            
            showNotification(
                `Commande !${commandName} ${data.enabled ? 'activée' : 'désactivée'}`,
                data.enabled ? 'success' : 'info'
            );
            
            // Rafraîchir l'affichage
            displayCommands();
        } else {
            showNotification(data.message || 'Erreur lors du changement d\'état', 'error');
            // Recharger les commandes pour avoir l'état correct
            await loadCommands();
        }
    } catch (error) {
        console.error('Erreur toggle command:', error);
        showNotification('Erreur de connexion', 'error');
        await loadCommands();
    }
}

async function refreshCommands() {
    showNotification('Actualisation des commandes...', 'info');
    await loadCommands();
}

// Ajouter le chargement des commandes à l'initialisation
const originalLoadAllData = loadAllData;
loadAllData = async function() {
    await Promise.all([
        originalLoadAllData(),
        loadCommands()
    ]);
};

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