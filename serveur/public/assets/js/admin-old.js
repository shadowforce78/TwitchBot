// ==== ADMIN PANEL FUNCTIONALITY ====

let currentTab = 'giveaways';
let giveaways = [];

// ==== INITIALIZATION ====
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Admin panel loaded');
    
    await loadUserInfo();
    checkAdminAccess();
    initializeTabs();
    await loadAllData();
    
    // Initialize event listeners
    initializeEventListeners();
});

// ==== AUTHENTICATION & ACCESS ====
async function checkAdminAccess() {
    try {
        const userInfo = getUserInfo();
        if (!userInfo || !isAdmin()) {
            showNotification('Accès refusé - Admin requis', 'error');
            window.location.href = '/panel';
            return;
        }
    } catch (error) {
        console.error('Erreur vérification admin:', error);
        window.location.href = '/panel';
    }
}

function isAdmin() {
    const userInfo = getUserInfo();
    return userInfo && userInfo.isAdmin;
}

// ==== TAB MANAGEMENT ====
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tab;
            switchTab(tab);
        });
    });
    
    // Show default tab
    switchTab('giveaways');
}

function switchTab(tabName) {
    // Update button states
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update content visibility
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    currentTab = tabName;
    
    // Load tab-specific data if needed
    switch(tabName) {
        case 'giveaways':
            loadGiveaways();
            break;
    }
}

// ==== DATA LOADING ====
async function loadAllData() {
    await Promise.all([
        loadGiveaways(),
        updateBotStatus()
    ]);
}

async function loadGiveaways() {
    try {
        const response = await fetch('/api/giveaways');
        if (response.ok) {
            giveaways = await response.json();
            displayGiveaways();
            updateGiveawayStats();
        }
    } catch (error) {
        console.error('Erreur chargement giveaways:', error);
        showNotification('Erreur lors du chargement des giveaways', 'error');
    }
}

async function updateBotStatus() {
    try {
        const response = await fetch('/api/bot-status');
        if (response.ok) {
            const status = await response.json();
            displayBotStatus(status);
        }
    } catch (error) {
        console.error('Erreur statut bot:', error);
    }
}

// ==== DISPLAY FUNCTIONS ====
function displayGiveaways() {
    const container = document.getElementById('admin-giveaways-list') || document.querySelector('.admin-giveaways-list');
    if (!container) return;
    
    if (giveaways.length === 0) {
        container.innerHTML = '<p class="text-muted">Aucun giveaway trouvé</p>';
        return;
    }
    
    container.innerHTML = giveaways.map(giveaway => `
        <div class="admin-giveaway-item" data-id="${giveaway.id}">
            <div class="admin-giveaway-header">
                <h4 class="admin-giveaway-title">${escapeHtml(giveaway.title)}</h4>
                <div class="admin-giveaway-actions">
                    <button class="btn btn-icon btn-view" onclick="viewGiveaway(${giveaway.id})" title="Voir">
                        👁️
                    </button>
                    <button class="btn btn-icon btn-edit" onclick="editGiveaway(${giveaway.id})" title="Modifier">
                        ✏️
                    </button>
                    <button class="btn btn-icon btn-winner" onclick="drawWinner(${giveaway.id})" title="Tirer au sort">
                        🎲
                    </button>
                    <button class="btn btn-icon btn-delete" onclick="deleteGiveaway(${giveaway.id})" title="Supprimer">
                        🗑️
                    </button>
                </div>
            </div>
            <div class="admin-giveaway-info">
                <div class="admin-giveaway-details">
                    <p><strong>Récompense:</strong> ${escapeHtml(giveaway.reward)}</p>
                    <p><strong>Description:</strong> ${escapeHtml(giveaway.description)}</p>
                    <p><strong>Statut:</strong> <span class="text-${getStatusColor(giveaway.status)}">${getStatusText(giveaway.status)}</span></p>
                    <p><strong>Date de fin:</strong> ${formatDate(giveaway.end_date)}</p>
                </div>
                <div class="admin-giveaway-stats">
                    <div class="admin-stat-item">
                        <span class="admin-stat-label">Participants</span>
                        <span class="admin-stat-value">${giveaway.participant_count || 0}</span>
                    </div>
                    <div class="admin-stat-item">
                        <span class="admin-stat-label">Min. follows</span>
                        <span class="admin-stat-value">${giveaway.min_follows || 0}</span>
                    </div>
                    <div class="admin-stat-item">
                        <span class="admin-stat-label">Min. messages</span>
                        <span class="admin-stat-value">${giveaway.min_messages || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function displayBotStatus(status) {
    const statusItems = document.querySelectorAll('.status-value');
    if (statusItems.length >= 4) {
        statusItems[0].textContent = status.connected ? 'Connecté' : 'Déconnecté';
        statusItems[1].textContent = status.channel || 'N/A';
        statusItems[2].textContent = status.commandCount || '0';
        statusItems[3].textContent = status.uptime || '0s';
    }
    
    // Update status icons
    const statusIcons = document.querySelectorAll('.status-icon');
    if (statusIcons.length >= 4) {
        statusIcons[0].textContent = status.connected ? '🟢' : '🔴';
        statusIcons[1].textContent = '📺';
        statusIcons[2].textContent = '⚡';
        statusIcons[3].textContent = '⏱️';
    }
}

function updateGiveawayStats() {
    const stats = giveaways.reduce((acc, g) => {
        acc.total++;
        if (g.status === 'active') acc.active++;
        if (g.status === 'ended') acc.ended++;
        acc.participants += g.participant_count || 0;
        return acc;
    }, { total: 0, active: 0, ended: 0, participants: 0 });
    
    const statsElements = document.querySelectorAll('.giveaway-stats .card-value');
    if (statsElements.length >= 4) {
        statsElements[0].textContent = stats.total;
        statsElements[1].textContent = stats.active;
        statsElements[2].textContent = stats.ended;
        statsElements[3].textContent = stats.participants;
    }
}

// ==== GIVEAWAY MANAGEMENT ====
function createGiveaway() {
    openModal('create-giveaway-modal');
}

function openCreateGiveawayModal() {
    openModal('create-giveaway-modal');
}

function editGiveaway(id) {
    const giveaway = giveaways.find(g => g.id === id);
    if (!giveaway) return;
    
    // Fill form with existing data
    document.getElementById('edit-giveaway-title').value = giveaway.title;
    document.getElementById('edit-giveaway-reward').value = giveaway.reward;
    document.getElementById('edit-giveaway-description').value = giveaway.description;
    document.getElementById('edit-giveaway-end-date').value = giveaway.end_date.slice(0, 16);
    document.getElementById('edit-giveaway-min-follows').value = giveaway.min_follows || 0;
    document.getElementById('edit-giveaway-min-messages').value = giveaway.min_messages || 0;
    
    // Store ID for update
    document.getElementById('edit-giveaway-form').dataset.giveawayId = id;
    
    openModal('edit-giveaway-modal');
}

function viewGiveaway(id) {
    const giveaway = giveaways.find(g => g.id === id);
    if (!giveaway) return;
    
    showNotification(`Giveaway: ${giveaway.title} - ${giveaway.participant_count || 0} participants`, 'info');
}

async function drawWinner(id) {
    if (!confirm('Tirer au sort un gagnant pour ce giveaway ?')) return;
    
    try {
        const response = await fetch(`/api/giveaways/${id}/draw-winner`, {
            method: 'POST'
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`Gagnant tiré au sort: ${result.winner.display_name}!`, 'success');
            await loadGiveaways();
        } else {
            throw new Error('Erreur lors du tirage');
        }
    } catch (error) {
        console.error('Erreur tirage:', error);
        showNotification('Erreur lors du tirage au sort', 'error');
    }
}

async function deleteGiveaway(id) {
    if (!confirm('Supprimer ce giveaway ?')) return;
    
    try {
        const response = await fetch(`/api/giveaways/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Giveaway supprimé', 'success');
            await loadGiveaways();
        } else {
            throw new Error('Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('Erreur suppression:', error);
        showNotification('Erreur lors de la suppression', 'error');
    }
}

// ==== EVENT LISTENERS ====
function initializeEventListeners() {
    // Giveaway forms
    const createGiveawayForm = document.getElementById('create-giveaway-form');
    if (createGiveawayForm) {
        createGiveawayForm.addEventListener('submit', handleCreateGiveaway);
    }
    
    const editGiveawayForm = document.getElementById('edit-giveaway-form');
    if (editGiveawayForm) {
        editGiveawayForm.addEventListener('submit', handleEditGiveaway);
    }
    
    // Bot controls
    const startBotBtn = document.getElementById('start-bot');
    const stopBotBtn = document.getElementById('stop-bot');
    
    if (startBotBtn) startBotBtn.addEventListener('click', startBot);
    if (stopBotBtn) stopBotBtn.addEventListener('click', stopBot);
}

// ==== FORM HANDLERS ====
async function handleCreateGiveaway(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const giveawayData = {
        title: formData.get('title'),
        reward: formData.get('reward'),
        description: formData.get('description'),
        end_date: formData.get('end_date'),
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
            throw new Error('Erreur lors de la création');
        }
    } catch (error) {
        console.error('Erreur création giveaway:', error);
        showNotification('Erreur lors de la création', 'error');
    }
}

async function handleEditGiveaway(e) {
    e.preventDefault();
    
    const giveawayId = e.target.dataset.giveawayId;
    const formData = new FormData(e.target);
    const giveawayData = {
        title: formData.get('title'),
        reward: formData.get('reward'),
        description: formData.get('description'),
        end_date: formData.get('end_date'),
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
            throw new Error('Erreur lors de la modification');
        }
    } catch (error) {
        console.error('Erreur modification giveaway:', error);
        showNotification('Erreur lors de la modification', 'error');
    }
}

// ==== BOT CONTROL ====
async function startBot() {
    try {
        const response = await fetch('/api/bot/start', { method: 'POST' });
        
        if (response.ok) {
            showNotification('Bot démarré', 'success');
            await updateBotStatus();
        } else {
            throw new Error('Erreur lors du démarrage');
        }
    } catch (error) {
        console.error('Erreur démarrage bot:', error);
        showNotification('Erreur lors du démarrage', 'error');
    }
}

async function stopBot() {
    try {
        const response = await fetch('/api/bot/stop', { method: 'POST' });
        
        if (response.ok) {
            showNotification('Bot arrêté', 'success');
            await updateBotStatus();
        } else {
            throw new Error('Erreur lors de l\'arrêt');
        }
    } catch (error) {
        console.error('Erreur arrêt bot:', error);
        showNotification('Erreur lors de l\'arrêt', 'error');
    }
}

// ==== UTILITY FUNCTIONS ====
function getStatusColor(status) {
    switch(status) {
        case 'active': return 'success';
        case 'ended': return 'warning';
        case 'cancelled': return 'error';
        default: return 'info';
    }
}

function getStatusText(status) {
    switch(status) {
        case 'active': return 'Actif';
        case 'ended': return 'Terminé';
        case 'cancelled': return 'Annulé';
        default: return 'Inconnu';
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('fr-FR');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}