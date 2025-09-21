// Variables globales
let isUserLoggedIn = false;

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      window.location.href = '/login';
    });
  }

  // Bouton giveaway
  const giveawayBtn = document.querySelector('.giveaway');
  if (giveawayBtn) {
    giveawayBtn.addEventListener('click', (e) => {
      if (!isUserLoggedIn) {
        e.preventDefault();
        alert('Vous devez être connecté pour accéder aux giveaways !');
        window.location.href = '/login';
        return;
      }
      window.location.href = '/giveaway';
    });
  }

  // Bouton admin panel
  const adminBtn = document.getElementById('adminBtn');
  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      window.location.href = '/panel';
    });
  }

  // Vérifier l'état de connexion
  fetch('/api/me').then(r=>r.json()).then(data => {
    isUserLoggedIn = data.loggedIn;
    
    if (data.loggedIn) {
      const loginBtn = document.getElementById('loginBtn');
      const userMenu = document.getElementById('userMenu');
      if (loginBtn && userMenu) {
        loginBtn.style.display = 'none';
        userMenu.style.display = 'block';
        
        // Afficher la photo de profil si disponible
        const avatar = document.getElementById('twitchPDP');
        if (avatar && data.profileImage) {
          avatar.src = data.profileImage;
        }
      }
      
      // Afficher le bouton admin si l'utilisateur est administrateur
      if (data.isModerator && adminBtn) {
        adminBtn.style.display = 'inline-block';
      }
      
      // Activer visuellement le bouton giveaway
      if (giveawayBtn) {
        giveawayBtn.classList.add('enabled');
      }
    } else {
      // Désactiver visuellement le bouton giveaway
      if (giveawayBtn) {
        giveawayBtn.classList.add('disabled');
        giveawayBtn.title = 'Connexion requise pour accéder aux giveaways';
      }
    }
  }).catch(()=>{});

  // Charger et afficher les giveaways sur la homepage
  loadHomeGiveaways();
});

// Fonction pour charger les giveaways sur la homepage
async function loadHomeGiveaways() {
  try {
    const response = await fetch('/api/giveaways');
    if (response.ok) {
      const giveaways = await response.json();
      displayHomeGiveaways(giveaways);
    }
  } catch (error) {
    console.error('Erreur lors du chargement des giveaways:', error);
  }
}

// Fonction pour afficher les giveaways sur la homepage
function displayHomeGiveaways(giveaways) {
  const giveawaySection = document.getElementById('home-giveaways');
  if (!giveawaySection) return;

  if (giveaways.length === 0) {
    giveawaySection.innerHTML = '<p>Aucun giveaway actif pour le moment</p>';
    return;
  }

  const giveawayCards = giveaways.slice(0, 3).map(giveaway => `
    <div class="giveaway-preview-card">
      <h4>${escapeHtml(giveaway.title)}</h4>
      ${giveaway.image_url ? `<img src="${escapeHtml(giveaway.image_url)}" alt="${escapeHtml(giveaway.title)}" class="giveaway-preview-image">` : ''}
      <p class="giveaway-preview-description">${escapeHtml(giveaway.description || '')}</p>
      <div class="giveaway-preview-info">
        <span class="participant-count">👥 ${giveaway.participant_count || 0} participants</span>
        <span class="giveaway-status status-${giveaway.status}">${giveaway.status.toUpperCase()}</span>
      </div>
      <button class="btn-participate-preview" onclick="handleGiveawayAccess()">
        ${giveaway.status === 'ouvert' ? 'Participer' : 'Voir détails'}
      </button>
    </div>
  `).join('');

  giveawaySection.innerHTML = `
    <h3>🎁 Giveaways en cours</h3>
    <div class="giveaway-preview-grid">
      ${giveawayCards}
    </div>
    <button class="btn-view-all" onclick="handleGiveawayAccess()">Voir tous les giveaways</button>
  `;
}

// Fonction pour gérer l'accès aux giveaways
function handleGiveawayAccess() {
  if (!isUserLoggedIn) {
    alert('Vous devez être connecté pour accéder aux giveaways !');
    window.location.href = '/login';
    return;
  }
  window.location.href = '/giveaway';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
