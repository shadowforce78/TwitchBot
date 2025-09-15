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
