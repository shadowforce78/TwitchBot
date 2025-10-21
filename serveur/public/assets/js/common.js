// ==== COMMON UTILITIES ====

// Global state
let currentUser = null;
let isAdmin = false;

// ==== AUTHENTICATION ====
async function checkAuth() {
    try {
        const response = await fetch('/api/me');
        const data = await response.json();
        
        if (data.isAuthenticated) {
            currentUser = {
                id: data.id,
                login: data.login,
                display_name: data.displayName,
                profile_image_url: data.avatar || data.profileImage
            };
            isAdmin = data.isAuthorized || data.isWhitelisted || data.isAdmin;
            
            // Update UI for connected user
            updateUserDisplay(true);
            return true;
        } else {
            // User not connected - show login interface
            updateUserDisplay(false);
            return false;
        }
    } catch (error) {
        console.error('Erreur lors de la vérification de l\'authentification:', error);
        showNotification('Erreur de connexion', 'error');
        updateUserDisplay(false);
        return false;
    }
}

// Handle authentication - redirect to login
function handleAuth() {
    window.location.href = '/login';
}

function updateUserDisplay(isConnected) {
    // New navbar structure
    const userInfo = document.getElementById('user-info');
    const authBtn = document.getElementById('auth-btn');
    const adminLink = document.getElementById('admin-link');
    
    // Old structure (for compatibility)
    const userConnected = document.getElementById('user-connected');
    const userNotConnected = document.getElementById('user-not-connected');
    const userParticipationsLabel = document.getElementById('user-participations-label');
    
    if (isConnected && currentUser) {
        // New navbar structure
        if (userInfo) {
            userInfo.style.display = 'flex';
            
            // Update user info in navbar
            const userAvatar = document.getElementById('user-avatar');
            const userName = document.getElementById('user-name');
            
            if (userAvatar && currentUser.profile_image_url) {
                userAvatar.src = currentUser.profile_image_url;
            }
            
            if (userName) {
                userName.textContent = currentUser.display_name || currentUser.login;
            }
        }
        
        if (authBtn) {
            authBtn.style.display = 'none';
        }
        
        // Show admin link if user is admin
        if (adminLink && isAdmin) {
            adminLink.style.display = 'inline-block';
        }
        
        // Old structure compatibility
        if (userConnected) userConnected.style.display = 'flex';
        if (userNotConnected) userNotConnected.style.display = 'none';
        if (userParticipationsLabel) {
            userParticipationsLabel.textContent = 'Vos Participations';
        }
    } else {
        // New navbar structure
        if (userInfo) {
            userInfo.style.display = 'none';
        }
        
        if (authBtn) {
            authBtn.style.display = 'inline-block';
        }
        
        if (adminLink) {
            adminLink.style.display = 'none';
        }
        
        // Old structure compatibility
        if (userConnected) userConnected.style.display = 'none';
        if (userNotConnected) userNotConnected.style.display = 'flex';
        if (userParticipationsLabel) {
            userParticipationsLabel.textContent = 'Connectez-vous';
        }
    }
}

function logout() {
    // Mettre à jour l'UI immédiatement avant la redirection
    currentUser = null;
    isAdmin = false;
    updateUserDisplay(false);
    
    // Rediriger vers la route de déconnexion
    window.location.href = '/logout';
}

// Alias for compatibility
function handleLogout() {
    showNotification('Déconnexion en cours...', 'info');
    logout();
}

// ==== NOTIFICATIONS ====
function showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notification-container') || createNotificationContainer();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Show animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Hide and remove
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notification-container';
    container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1100;
        display: flex;
        flex-direction: column;
        gap: 10px;
    `;
    document.body.appendChild(container);
    return container;
}

// ==== MODAL UTILITIES ====
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId = null) {
    const modals = modalId ? [document.getElementById(modalId)] : document.querySelectorAll('.modal.active');
    
    modals.forEach(modal => {
        if (modal) {
            modal.classList.remove('active');
        }
    });
    
    document.body.style.overflow = '';
}

// Close modal on outside click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeModal();
    }
});

// Close modal on escape key
document.addEventListener('keyDown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// ==== API UTILITIES ====
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Request failed:', error);
        throw error;
    }
}

// ==== FORMATTING UTILITIES ====
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    const intervals = {
        'an': 31536000,
        'mois': 2592000,
        'semaine': 604800,
        'jour': 86400,
        'heure': 3600,
        'minute': 60
    };
    
    for (let [unit, seconds] of Object.entries(intervals)) {
        const interval = Math.floor(diffInSeconds / seconds);
        if (interval >= 1) {
            return `Il y a ${interval} ${unit}${interval > 1 && unit !== 'mois' ? 's' : ''}`;
        }
    }
    
    return 'À l\'instant';
}

function formatNumber(number) {
    return new Intl.NumberFormat('fr-FR').format(number);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

// ==== COUNTDOWN UTILITIES ====
function createCountdown(endDate, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    function updateCountdown() {
        const now = new Date().getTime();
        const end = new Date(endDate).getTime();
        const distance = end - now;
        
        if (distance < 0) {
            container.innerHTML = '<div class="countdown-expired">Terminé</div>';
            return;
        }
        
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        container.innerHTML = `
            <div class="countdown-item">
                <span class="countdown-value">${days}</span>
                <span class="countdown-label">jours</span>
            </div>
            <div class="countdown-item">
                <span class="countdown-value">${hours}</span>
                <span class="countdown-label">heures</span>
            </div>
            <div class="countdown-item">
                <span class="countdown-value">${minutes}</span>
                <span class="countdown-label">min</span>
            </div>
            <div class="countdown-item">
                <span class="countdown-value">${seconds}</span>
                <span class="countdown-label">sec</span>
            </div>
        `;
    }
    
    updateCountdown();
    return setInterval(updateCountdown, 1000);
}

// ==== LOADING UTILITIES ====
function showLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '<div class="loading">Chargement...</div>';
    }
}

function hideLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        const loading = container.querySelector('.loading');
        if (loading) {
            loading.remove();
        }
    }
}

// ==== ESCAPING UTILITIES ====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==== STORAGE UTILITIES ====
function getFromStorage(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch (error) {
        return null;
    }
}

function setToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error('Storage error:', error);
        return false;
    }
}

function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        return false;
    }
}

// ==== NAVIGATION FUNCTIONS ====
function login() {
    window.location.href = '/login';
}

function goToAdmin() {
    window.location.href = '/panel';
}

// ==== USER INFO ====
function getUserInfo() {
    return currentUser;
}

// ==== INITIALIZATION ====
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const isAuthenticated = await checkAuth();
    
    if (isAuthenticated) {
        // Initialize page-specific functionality
        if (typeof initializePage === 'function') {
            initializePage();
        }
    }
});

// ==== EXPORT FOR MODULES ====
window.TwitchBotPanel = {
    currentUser,
    isAdmin,
    checkAuth,
    updateUserDisplay,
    logout,
    showNotification,
    openModal,
    closeModal,
    apiRequest,
    formatDate,
    formatTimeAgo,
    formatNumber,
    formatCurrency,
    createCountdown,
    showLoading,
    hideLoading,
    escapeHtml,
    getFromStorage,
    setToStorage,
    removeFromStorage,
    submitSuggestion
};

// ==== FORMULAIRE DE SUGGESTION ====
async function submitSuggestion(event) {
    event.preventDefault();
    const textarea = document.getElementById('suggestion-text');
    const suggestion = textarea.value.trim();
    
    if (!suggestion) {
        showNotification('Veuillez entrer une suggestion', 'error');
        return;
    }
    
    showNotification('Merci pour votre suggestion ! 💡', 'success');
    textarea.value = '';
}