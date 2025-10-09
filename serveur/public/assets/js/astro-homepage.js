// ==== ASTRO HOMEPAGE FUNCTIONALITY ====

let user = null;
let giveaways = [];

// ==== INITIALIZATION ====
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Astro homepage loaded');
    
    await loadUserInfo();
    await loadGiveaways();
    
    updateUI();
    initializeEventListeners();
});

// ==== AUTHENTICATION & USER INFO ====
async function loadUserInfo() {
    try {
        const response = await fetch('/api/me');
        if (response.ok) {
            user = await response.json();
            console.log('User info loaded:', user);
        } else {
            user = null;
        }
    } catch (error) {
        console.error('Erreur chargement user info:', error);
        user = null;
    }
}

function updateUI() {
    const userInfo = document.getElementById('user-info');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const authBtn = document.getElementById('auth-btn');
    const adminLink = document.getElementById('admin-link');

    const heroActions = document.getElementById('hero-actions');
    const featuresGrid = document.getElementById('features-grid');

    if (user && user.isAuthenticated) {
        // User is logged in
        userInfo.style.display = 'flex';
        userAvatar.src = user.avatar || 'https://via.placeholder.com/32x32';
        userName.textContent = user.displayName || user.login;
        authBtn.textContent = '🚪 Déconnexion';
        authBtn.onclick = logout;

        // Show admin elements if user is admin
        if (user.isAdmin) {
            adminLink.style.display = 'block';
        }

        updateHeroActions(true, user.isAdmin);
    } else {
        // User is not logged in
        userInfo.style.display = 'none';
        adminLink.style.display = 'none';
        authBtn.textContent = '🔗 Se connecter';
        authBtn.onclick = () => window.location.href = '/login';

        updateHeroActions(false, false);
    }
}

function updateHeroActions(isLoggedIn, isAdmin) {
    const heroActions = document.getElementById('hero-actions');
    
    if (isAdmin) {
        heroActions.innerHTML = `
            <a href="/admin" class="btn btn-primary">
                ⚙️ Panel Admin
            </a>
            <a href="#giveaways" class="btn btn-secondary">
                🎁 Voir les Giveaways
            </a>
        `;
    } else if (isLoggedIn) {
        heroActions.innerHTML = `
            <a href="#giveaways" class="btn btn-primary">
                🎁 Participer aux Giveaways
            </a>
        `;
    } else {
        heroActions.innerHTML = `
            <a href="/login" class="btn btn-primary">
                🔗 Se connecter avec Twitch
            </a>
            <a href="#giveaways" class="btn btn-secondary">
                🎁 Voir les Giveaways
            </a>
        `;
    }
}







// ==== GIVEAWAYS LOADING ====
async function loadGiveaways() {
    try {
        const response = await fetch('/api/giveaways');
        if (response.ok) {
            giveaways = await response.json();
            displayGiveaways();
        }
    } catch (error) {
        console.error('Erreur chargement giveaways:', error);
        displayGiveawaysError();
    }
}

function displayGiveaways() {
    const giveawaysContainer = document.getElementById('giveaways-list');
    
    if (giveaways.length === 0) {
        giveawaysContainer.innerHTML = '<p class="text-center text-secondary">Aucun giveaway actif pour le moment</p>';
        return;
    }

    const activeGiveaways = giveaways.filter(g => g.state === 'ouvert' || g.status === 'active');
    
    if (activeGiveaways.length === 0) {
        giveawaysContainer.innerHTML = '<p class="text-center text-secondary">Aucun giveaway actif pour le moment</p>';
        return;
    }

    giveawaysContainer.innerHTML = activeGiveaways.map(giveaway => `
        <div class="feature-card">
            ${giveaway.image && giveaway.image.trim() ? 
                `<div class="giveaway-image">
                    <img src="${escapeHtml(giveaway.image)}" alt="${escapeHtml(giveaway.titre || giveaway.title)}" loading="lazy">
                </div>` : 
                `<div class="feature-icon">🎁</div>`
            }
            <h3>${escapeHtml(giveaway.titre || giveaway.title)}</h3>
            <p><strong>Récompense:</strong> ${escapeHtml(giveaway.prix || giveaway.reward)}</p>
            <p>${escapeHtml(giveaway.description || 'Aucune description')}</p>
            <div class="giveaway-meta">
                <small>👥 ${giveaway.participant_count || giveaway.nb_participants || 0} participants</small>
                ${giveaway.date_tirage || giveaway.end_date ? 
                    `<small>📅 Fin: ${formatDate(giveaway.date_tirage || giveaway.end_date)}</small>` : 
                    ''
                }
            </div>
            ${user && user.isAuthenticated ? 
                `<button class="btn btn-primary" onclick="participateGiveaway(${giveaway.id})">
                    ${giveaway.is_participating ? '✅ Participant' : '🎯 Participer'}
                </button>` :
                `<button class="btn btn-outline" onclick="showLoginRequired()">
                    🔗 Se connecter pour participer
                </button>`
            }
        </div>
    `).join('');
}

function displayGiveawaysError() {
    const giveawaysContainer = document.getElementById('giveaways-list');
    giveawaysContainer.innerHTML = '<p class="text-center text-error">Erreur lors du chargement des giveaways</p>';
}

// ==== GIVEAWAY PARTICIPATION ====
async function participateGiveaway(giveawayId) {
    if (!user || !user.isAuthenticated) {
        showLoginRequired();
        return;
    }

    try {
        const giveaway = giveaways.find(g => g.id === giveawayId);
        if (!giveaway) return;

        if (giveaway.is_participating) {
            // Leave giveaway
            const response = await fetch(`/api/giveaways/${giveawayId}/leave`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showNotification('Vous avez quitté le giveaway', 'success');
                await loadGiveaways(); // Reload to update UI
            } else {
                const error = await response.json();
                showNotification(error.message || 'Erreur lors de la sortie du giveaway', 'error');
            }
        } else {
            // Join giveaway
            const response = await fetch(`/api/giveaways/${giveawayId}/participate`, {
                method: 'POST'
            });

            if (response.ok) {
                showNotification('Participation enregistrée avec succès !', 'success');
                await loadGiveaways(); // Reload to update UI
            } else {
                const error = await response.json();
                showNotification(error.message || 'Erreur lors de la participation', 'error');
            }
        }
    } catch (error) {
        console.error('Erreur participation giveaway:', error);
        showNotification('Erreur de connexion', 'error');
    }
}

function showLoginRequired() {
    showNotification('Vous devez être connecté pour participer', 'warning');
    setTimeout(() => {
        window.location.href = '/login';
    }, 2000);
}

// ==== EVENT LISTENERS ====
function initializeEventListeners() {
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// ==== AUTH FUNCTIONS ====
function handleAuth() {
    if (user && user.isAuthenticated) {
        logout();
    } else {
        window.location.href = '/login';
    }
}

async function logout() {
    try {
        const response = await fetch('/logout', { method: 'POST' });
        if (response.ok) {
            user = null;
            updateUI();
            showNotification('Déconnexion réussie', 'success');
            // Reload giveaways to update participation status
            await loadGiveaways();
        }
    } catch (error) {
        console.error('Erreur déconnexion:', error);
        showNotification('Erreur lors de la déconnexion', 'error');
    }
}

// ==== UTILITY FUNCTIONS ====
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