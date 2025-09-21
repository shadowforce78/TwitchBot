let commands = [];

document.addEventListener('DOMContentLoaded', () => {
  // Vérification auth utilisateur avec debug
  fetch('/api/me').then(r=>r.json()).then(data => {
    const userInfo = document.getElementById('userInfo');
    if (!data.loggedIn) {
      userInfo.textContent = 'Non connecté';
      window.location.href = '/';
      return;
    }
    console.log('User auth status:', data);
    if (!(data.isModerator || data.isWhitelisted)) {
      console.error('Access denied - checking auth debug...');
      // Afficher infos de debug
      fetch('/api/debug-auth').then(r=>r.json()).then(debug => {
        console.log('Auth debug:', debug);
        alert(`Accès refusé. Debug info:\nLogin: ${debug.user?.login}\nAuthorized: ${debug.user?.isAuthorized}\nWhitelisted: ${debug.user?.isWhitelisted}\nWhitelist config: ${debug.whitelist}\nChannel: ${debug.channelLogin}`);
      });
      window.location.href = '/no-access';
      return;
    }
    userInfo.innerHTML = `<img class="pdp" src="${data.profileImage}" alt="pdp"/> ${data.displayName}`;
  }).catch(err => console.error(err));

  // Chargement initial des commandes
  loadCommands();
});

function loadCommands() {
  fetch('/api/commands').then(r => {
    if (!r.ok) throw new Error('forbidden');
    return r.json();
  }).then(cmds => {
    commands = cmds || [];
    renderCommands();
  }).catch(() => {
    document.getElementById('commands-panel').textContent = 'Erreur chargement commandes';
  });
}

function renderCommands() {
  const panel = document.getElementById('commands-panel');
  if (!Array.isArray(commands) || commands.length === 0) {
    panel.innerHTML = '<p style="color: #888; text-align: center;">Aucune commande trouvée</p>';
    return;
  }

  panel.innerHTML = '';
  commands.forEach((cmd, index) => {
    const box = document.createElement('div');
    box.className = 'command-box';
    
    const isProtected = ['command', 'help'].includes(cmd.name);
    const deleteButton = isProtected ? '' : `<button class="btn-edit" style="background: #f44336;" onclick="deleteCommand('${cmd.name}', ${index})">🗑️ Supprimer</button>`;
    
    box.innerHTML = `
      <div class="command-header">
        <h3 class="command-name">${cmd.name}</h3>
        <span class="command-type">${cmd.type}</span>
      </div>
      <p style="color: #bbb; margin: 10px 0;">${cmd.description || 'Aucune description'}</p>
      
      ${cmd.type === 'basic' ? `
        <div class="command-content" contenteditable="true" data-original="${escapeHtml(cmd.content || '')}">${escapeHtml(cmd.content || '')}</div>
        <div class="command-actions">
          <button class="btn-edit" onclick="editCommand(${index})">✏️ Modifier</button>
          <button class="btn-save" onclick="saveCommand('${cmd.name}', ${index})">💾 Sauvegarder</button>
          ${deleteButton}
        </div>
      ` : `
        <div class="command-actions">
          ${deleteButton}
        </div>
      `}
      
      <div style="margin-top: 15px; display: flex; align-items: center; justify-content: space-between;">
        <label class="switch">
          <input type="checkbox" ${cmd.enabled ? 'checked' : ''} onchange="toggleCommand('${cmd.name}', ${index}, this)">
          <span class="slider"></span>
        </label>
        <span style="color: ${cmd.enabled ? '#C7F2C7' : '#f44336'}; font-weight: 500;">
          ${cmd.enabled ? '✅ Activée' : '❌ Désactivée'}
        </span>
      </div>
    `;
    
    panel.appendChild(box);
  });
}

function editCommand(index) {
  const box = document.querySelectorAll('.command-box')[index];
  const content = box.querySelector('.command-content');
  const editBtn = box.querySelector('.btn-edit');
  const saveBtn = box.querySelector('.btn-save');
  
  content.focus();
  editBtn.style.display = 'none';
  saveBtn.style.display = 'inline-block';
  
  // Sauvegarder l'original pour pouvoir annuler
  content.dataset.editing = 'true';
}

function saveCommand(name, index) {
  const box = document.querySelectorAll('.command-box')[index];
  const content = box.querySelector('.command-content');
  const newContent = content.textContent.trim();
  const editBtn = box.querySelector('.btn-edit');
  const saveBtn = box.querySelector('.btn-save');
  
  if (!newContent) {
    alert('Le contenu ne peut pas être vide !');
    return;
  }
  
  // Désactiver le bouton pendant la sauvegarde
  saveBtn.disabled = true;
  saveBtn.textContent = '⏳ Sauvegarde...';
  
  fetch(`/api/commands/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: newContent })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      showNotification('✅ Commande sauvegardée avec succès !', 'success');
      
      // Recharger toutes les commandes pour garantir la synchronisation
      loadCommands();
    } else {
      throw new Error(data.error || 'Erreur inconnue');
    }
  })
  .catch(err => {
    console.error('Erreur sauvegarde:', err);
    let message = '❌ Erreur lors de la sauvegarde';
    if (err.message.includes('content_pattern_not_found')) {
      message = '❌ Format de fichier de commande non reconnu';
    } else if (err.message.includes('only_basic_commands')) {
      message = '❌ Seules les commandes de type "basic" peuvent être modifiées';
    }
    showNotification(message, 'error');
    // Restaurer le contenu original
    content.textContent = content.dataset.original;
  })
  .finally(() => {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Sauvegarder';
  });
}

function toggleCommand(name, index, checkbox) {
  const originalChecked = checkbox.checked;
  checkbox.disabled = true;
  
  fetch(`/api/commands/${encodeURIComponent(name)}/toggle`, { method: 'POST' })
    .then(r => r.json())
    .then(data => {
      if (data && typeof data.enabled !== 'undefined') {
        commands[index].enabled = data.enabled;
        checkbox.checked = data.enabled;
        
        // Mettre à jour l'affichage du statut
        const statusSpan = checkbox.closest('.command-box').querySelector('span[style*="font-weight"]');
        if (statusSpan) {
          statusSpan.style.color = data.enabled ? '#C7F2C7' : '#f44336';
          statusSpan.textContent = data.enabled ? '✅ Activée' : '❌ Désactivée';
        }
        
        showNotification(`Commande '${name}' ${data.enabled ? 'activée' : 'désactivée'}`, 'info');
      }
    })
    .catch(() => {
      checkbox.checked = !originalChecked; // Restaurer l'état précédent
      showNotification('❌ Erreur lors du changement d\'état', 'error');
    })
    .finally(() => {
      checkbox.disabled = false;
    });
}

function showAddCommandForm() {
  document.getElementById('add-command-form').style.display = 'block';
  document.getElementById('new-cmd-name').focus();
  
  // Fonction de validation partagée
  window.checkNewCommandFields = function() {
    const nameInput = document.getElementById('new-cmd-name');
    const contentInput = document.getElementById('new-cmd-content');
    const createBtn = document.getElementById('btn-create-cmd');
    
    const name = nameInput.value.trim();
    const content = contentInput.value.trim();
    
    // Valider le format du nom
    const isValidName = /^[a-zA-Z0-9_-]+$/.test(name);
    const nameExists = commands.find(c => c.name.toLowerCase() === name.toLowerCase());
    
    // Afficher le bouton si nom valide, unique, et contenu présent
    if (name && content && isValidName && !nameExists) {
      createBtn.style.display = 'inline-block';
      createBtn.disabled = false;
    } else {
      createBtn.style.display = 'none';
      createBtn.disabled = true;
    }
    
    // Feedback visuel pour le nom
    if (name) {
      if (!isValidName) {
        nameInput.style.borderColor = '#f44336';
        nameInput.title = 'Seules les lettres, chiffres, tirets et underscores sont autorisés';
      } else if (nameExists) {
        nameInput.style.borderColor = '#ff9800';
        nameInput.title = 'Ce nom de commande existe déjà';
      } else {
        nameInput.style.borderColor = '#4CAF50';
        nameInput.title = '';
      }
    } else {
      nameInput.style.borderColor = '#555';
      nameInput.title = '';
    }
  };
  
  // Vérifier immédiatement
  checkNewCommandFields();
}

function hideAddCommandForm() {
  document.getElementById('add-command-form').style.display = 'none';
  
  // Réinitialiser les champs
  const nameInput = document.getElementById('new-cmd-name');
  const descInput = document.getElementById('new-cmd-description');
  const contentInput = document.getElementById('new-cmd-content');
  const createBtn = document.getElementById('btn-create-cmd');
  
  nameInput.value = '';
  descInput.value = '';
  contentInput.value = '';
  
  // Réinitialiser les styles
  nameInput.style.borderColor = '#555';
  nameInput.title = '';
  
  // Cacher le bouton créer
  createBtn.style.display = 'none';
  createBtn.disabled = true;
}

function createCommand() {
  const name = document.getElementById('new-cmd-name').value.trim().toLowerCase();
  const description = document.getElementById('new-cmd-description').value.trim();
  const content = document.getElementById('new-cmd-content').value.trim();
  
  if (!name || !content) {
    alert('Le nom et le contenu sont obligatoires !');
    return;
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    alert('Le nom ne peut contenir que des lettres, chiffres, tirets et underscores !');
    return;
  }
  
  if (commands.find(c => c.name === name)) {
    alert('Une commande avec ce nom existe déjà !');
    return;
  }
  
  fetch('/api/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, content })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      hideAddCommandForm();
      loadCommands(); // Recharger la liste
      showNotification('✅ Commande créée avec succès !', 'success');
    } else {
      throw new Error(data.error || 'Erreur inconnue');
    }
  })
  .catch(err => {
    console.error('Erreur création:', err);
    let message = '❌ Erreur lors de la création';
    if (err.message.includes('command_exists')) message = '❌ Cette commande existe déjà';
    if (err.message.includes('invalid_name')) message = '❌ Nom de commande invalide';
    showNotification(message, 'error');
  });
}

function deleteCommand(name, index) {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer la commande '${name}' ?\nCette action est irréversible !`)) {
    return;
  }
  
  fetch(`/api/commands/${encodeURIComponent(name)}`, { method: 'DELETE' })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        loadCommands(); // Recharger la liste
        showNotification(`✅ Commande '${name}' supprimée`, 'success');
      } else {
        throw new Error(data.error || 'Erreur inconnue');
      }
    })
    .catch(err => {
      console.error('Erreur suppression:', err);
      showNotification('❌ Erreur lors de la suppression', 'error');
    });
}

function sendTestMessage() {
  const message = document.getElementById('testMsg').value.trim();
  if (!message) {
    alert('Entrez un message de test !');
    return;
  }
  
  fetch('/api/chat/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  })
  .then(r => r.json())
  .then(data => {
    if (data.ok) {
      showNotification('✅ Message envoyé !', 'success');
      document.getElementById('testMsg').value = '';
    } else {
      throw new Error('Échec envoi');
    }
  })
  .catch(() => {
    showNotification('❌ Erreur envoi message', 'error');
  });
}

function showNotification(message, type = 'info') {
  // Créer une notification temporaire
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 6px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: all 0.3s ease;
  `;
  
  switch (type) {
    case 'success': notification.style.background = '#4CAF50'; break;
    case 'error': notification.style.background = '#f44336'; break;
    case 'info': notification.style.background = '#FF4BBA'; break;
    default: notification.style.background = '#555';
  }
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Supprimer après 3 secondes
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========== GESTION DES GIVEAWAYS ==========

// Fonction pour afficher/cacher le formulaire de création de giveaway
function showAddGiveawayForm() {
  document.getElementById('add-giveaway-form').style.display = 'block';
  document.getElementById('new-giveaway-title').focus();
}

function hideAddGiveawayForm() {
  document.getElementById('add-giveaway-form').style.display = 'none';
  // Reset des champs
  document.getElementById('new-giveaway-title').value = '';
  document.getElementById('new-giveaway-description').value = '';
  document.getElementById('new-giveaway-image').value = '';
  document.getElementById('btn-create-giveaway').style.display = 'none';
}

// Fonction pour vérifier les champs obligatoires du giveaway
function checkNewGiveawayFields() {
  const title = document.getElementById('new-giveaway-title').value.trim();
  const description = document.getElementById('new-giveaway-description').value.trim();
  const createBtn = document.getElementById('btn-create-giveaway');
  
  if (title && description) {
    createBtn.style.display = 'inline-block';
  } else {
    createBtn.style.display = 'none';
  }
}

// Fonction pour créer un giveaway
async function createGiveaway() {
  const title = document.getElementById('new-giveaway-title').value.trim();
  const description = document.getElementById('new-giveaway-description').value.trim();
  const imageUrl = document.getElementById('new-giveaway-image').value.trim();

  if (!title || !description) {
    showNotification('Le titre et la description sont requis', 'error');
    return;
  }

  try {
    const response = await fetch('/api/giveaways', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: title,
        description: description,
        image_url: imageUrl || null
      })
    });

    const data = await response.json();

    if (response.ok) {
      showNotification('Giveaway créé avec succès !', 'success');
      hideAddGiveawayForm();
      loadGiveaways(); // Recharger la liste
    } else {
      showNotification(data.message || 'Erreur lors de la création', 'error');
    }
  } catch (error) {
    console.error('Erreur création giveaway:', error);
    showNotification('Erreur de connexion', 'error');
  }
}

// Fonction pour charger les giveaways
async function loadGiveaways() {
  try {
    const response = await fetch('/api/giveaways');
    if (!response.ok) throw new Error('Erreur chargement');
    
    const giveaways = await response.json();
    renderGiveaways(giveaways);
  } catch (error) {
    console.error('Erreur chargement giveaways:', error);
    document.getElementById('giveaways-panel').innerHTML = 
      '<p style="color: #f44336; text-align: center;">Erreur lors du chargement des giveaways</p>';
  }
}

// Fonction pour afficher les giveaways
function renderGiveaways(giveaways) {
  const panel = document.getElementById('giveaways-panel');
  
  if (!Array.isArray(giveaways) || giveaways.length === 0) {
    panel.innerHTML = '<p style="color: #888; text-align: center;">Aucun giveaway actif</p>';
    return;
  }

  panel.innerHTML = giveaways.map(giveaway => `
    <div class="giveaway-item" style="border: 1px solid #555; border-radius: 6px; padding: 15px; margin-bottom: 10px; background: #2a2a2a;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
        <div style="flex: 1;">
          <h4 style="color: #FFC69B; margin: 0 0 5px 0;">${escapeHtml(giveaway.title)}</h4>
          <p style="color: #bbb; margin: 0; font-size: 0.9rem;">${escapeHtml(giveaway.description || '')}</p>
        </div>
        <span class="status-badge ${giveaway.status}" style="padding: 4px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 500; white-space: nowrap; margin-left: 10px;">
          ${giveaway.status.toUpperCase()}
        </span>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; color: #888;">
        <span>👥 ${giveaway.participant_count || 0} participant(s)</span>
        <span>📅 ${formatDate(giveaway.created_at)}</span>
      </div>
      
      ${giveaway.status === 'ouvert' ? `
        <div style="margin-top: 15px;">
          <button class="btn-danger" onclick="closeGiveaway(${giveaway.id})" style="background: #f44336; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
            Fermer le giveaway
          </button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

// Fonction pour fermer un giveaway
async function closeGiveaway(giveawayId) {
  if (!confirm('Êtes-vous sûr de vouloir fermer ce giveaway ?')) {
    return;
  }

  try {
    const response = await fetch(`/api/giveaways/${giveawayId}/close`, {
      method: 'PUT'
    });

    const data = await response.json();

    if (response.ok) {
      showNotification('Giveaway fermé avec succès', 'success');
      loadGiveaways(); // Recharger la liste
    } else {
      showNotification(data.message || 'Erreur lors de la fermeture', 'error');
    }
  } catch (error) {
    console.error('Erreur fermeture giveaway:', error);
    showNotification('Erreur de connexion', 'error');
  }
}

// Fonction pour formater une date
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

// Charger les giveaways au démarrage
document.addEventListener('DOMContentLoaded', () => {
  // Attendre un peu que l'auth soit vérifiée
  setTimeout(() => {
    loadGiveaways();
    loadWebhookStats();
  }, 1000);
});

// ========== GESTION DES DONNÉES WEBHOOK ==========

let currentWebhookTab = 'stats';
let currentUsersPage = 1;
let currentPassesPage = 1;

// Fonction pour basculer entre les onglets webhook
function showWebhookTab(tab) {
  // Masquer tous les contenus d'onglet
  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = 'none';
  });
  
  // Désactiver tous les boutons d'onglet
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Afficher le contenu sélectionné
  document.getElementById(`webhook-${tab}`).style.display = 'block';
  document.getElementById(`tab-${tab}`).classList.add('active');
  
  currentWebhookTab = tab;
  
  // Charger les données selon l'onglet
  switch(tab) {
    case 'stats':
      loadWebhookStats();
      break;
    case 'users':
      loadWebhookUsers(1);
      break;
    case 'passes':
      loadWebhookPasses(1);
      break;
  }
}

// Fonction pour charger les statistiques webhook
async function loadWebhookStats() {
  try {
    const response = await fetch('/api/webhook/stats');
    if (!response.ok) throw new Error('Erreur chargement stats');
    
    const stats = await response.json();
    renderWebhookStats(stats);
  } catch (error) {
    console.error('Erreur chargement stats webhook:', error);
    document.getElementById('webhook-stats-content').innerHTML = 
      '<p style="color: #f44336; text-align: center;">Erreur lors du chargement des statistiques</p>';
  }
}

// Fonction pour afficher les statistiques
function renderWebhookStats(stats) {
  const content = document.getElementById('webhook-stats-content');
  
  content.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
      <div class="stat-card">
        <h4 style="color: #4CAF50; margin: 0 0 10px 0;">👤 Utilisateurs</h4>
        <div class="stat-number">${stats.users.total}</div>
        <div class="stat-label">Total d'utilisateurs</div>
      </div>
      
      <div class="stat-card">
        <h4 style="color: #FF9800; margin: 0 0 10px 0;">🎫 Passes</h4>
        <div class="stat-number">${stats.passes.total}</div>
        <div class="stat-label">Total de passes</div>
      </div>
      
      <div class="stat-card">
        <h4 style="color: #2196F3; margin: 0 0 10px 0;">✅ Passes Valides</h4>
        <div class="stat-number">${stats.passes.valid}</div>
        <div class="stat-label">${stats.passes.validPercentage}% du total</div>
      </div>
      
      <div class="stat-card">
        <h4 style="color: #f44336; margin: 0 0 10px 0;">❌ Passes Expirées</h4>
        <div class="stat-number">${stats.passes.invalid}</div>
        <div class="stat-label">${100 - stats.passes.validPercentage}% du total</div>
      </div>
    </div>
    
    <div style="margin-top: 20px; text-align: center; color: #888; font-style: italic;">
      📡 Ces données sont automatiquement synchronisées via webhook
    </div>
  `;
}

// Fonction pour charger les utilisateurs
async function loadWebhookUsers(page = 1) {
  currentUsersPage = page;
  try {
    const response = await fetch(`/api/webhook/users?page=${page}&limit=20`);
    if (!response.ok) throw new Error('Erreur chargement users');
    
    const data = await response.json();
    renderWebhookUsers(data);
  } catch (error) {
    console.error('Erreur chargement users webhook:', error);
    document.getElementById('webhook-users-content').innerHTML = 
      '<p style="color: #f44336; text-align: center;">Erreur lors du chargement des utilisateurs</p>';
  }
}

// Fonction pour afficher les utilisateurs
function renderWebhookUsers(data) {
  const content = document.getElementById('webhook-users-content');
  
  if (!data.users || data.users.length === 0) {
    content.innerHTML = '<p style="color: #888; text-align: center;">Aucun utilisateur trouvé</p>';
    return;
  }

  const usersHtml = data.users.map(user => `
    <div class="webhook-item">
      <div class="webhook-item-header">
        <span class="webhook-item-title">👤 ${escapeHtml(user.username)}</span>
        <span class="webhook-item-id">ID: ${user.id_twitch}</span>
      </div>
      <div class="webhook-item-details">
        <span class="webhook-detail">Ajouté automatiquement par webhook</span>
      </div>
    </div>
  `).join('');

  content.innerHTML = usersHtml;
  renderPagination('users', data.pagination);
}

// Fonction pour charger les passes
async function loadWebhookPasses(page = 1) {
  currentPassesPage = page;
  try {
    const response = await fetch(`/api/webhook/passes?page=${page}&limit=20`);
    if (!response.ok) throw new Error('Erreur chargement passes');
    
    const data = await response.json();
    renderWebhookPasses(data);
  } catch (error) {
    console.error('Erreur chargement passes webhook:', error);
    document.getElementById('webhook-passes-content').innerHTML = 
      '<p style="color: #f44336; text-align: center;">Erreur lors du chargement des passes</p>';
  }
}

// Fonction pour afficher les passes
function renderWebhookPasses(data) {
  const content = document.getElementById('webhook-passes-content');
  
  if (!data.passes || data.passes.length === 0) {
    content.innerHTML = '<p style="color: #888; text-align: center;">Aucun passe trouvé</p>';
    return;
  }

  const passesHtml = data.passes.map(pass => `
    <div class="webhook-item">
      <div class="webhook-item-header">
        <span class="webhook-item-title">🎫 ${escapeHtml(pass.username || 'Utilisateur inconnu')}</span>
        <div>
          <span class="pass-status ${pass.valide ? 'valid' : 'invalid'}">${pass.valide ? '✅ VALIDE' : '❌ EXPIRÉ'}</span>
        </div>
      </div>
      <div class="webhook-item-details">
        <span class="webhook-detail">ID Twitch: ${pass.id_twitch}</span>
        <span class="webhook-detail">Statut: ${pass.valide ? 'Actif' : 'Inactif'}</span>
      </div>
    </div>
  `).join('');

  content.innerHTML = `
    <div style="margin-bottom: 15px; padding: 10px; background: #2a2a2a; border-radius: 6px;">
      <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: #bbb;">
        <span>📊 Total: ${data.stats.total}</span>
        <span>✅ Valides: ${data.stats.valid}</span>
        <span>❌ Expirés: ${data.stats.invalid}</span>
      </div>
    </div>
    ${passesHtml}
  `;
  renderPagination('passes', data.pagination);
}

// Fonction pour afficher la pagination
function renderPagination(type, pagination) {
  const container = document.getElementById(`${type}-pagination`);
  
  if (pagination.pages <= 1) {
    container.innerHTML = '';
    return;
  }

  let paginationHtml = '';
  
  // Bouton précédent
  if (pagination.page > 1) {
    paginationHtml += `<button class="pagination-btn" onclick="load${type === 'users' ? 'WebhookUsers' : 'WebhookPasses'}(${pagination.page - 1})">‹ Précédent</button>`;
  }
  
  // Numéros de page
  const startPage = Math.max(1, pagination.page - 2);
  const endPage = Math.min(pagination.pages, pagination.page + 2);
  
  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === pagination.page;
    paginationHtml += `<button class="pagination-btn ${isActive ? 'active' : ''}" onclick="load${type === 'users' ? 'WebhookUsers' : 'WebhookPasses'}(${i})">${i}</button>`;
  }
  
  // Bouton suivant
  if (pagination.page < pagination.pages) {
    paginationHtml += `<button class="pagination-btn" onclick="load${type === 'users' ? 'WebhookUsers' : 'WebhookPasses'}(${pagination.page + 1})">Suivant ›</button>`;
  }
  
  container.innerHTML = paginationHtml;
}
