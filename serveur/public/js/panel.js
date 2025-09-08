document.addEventListener('DOMContentLoaded', () => {
  fetch('/api/me').then(r=>r.json()).then(data => {
    const userInfo = document.getElementById('userInfo');
    if (!data.loggedIn) {
      userInfo.textContent = 'Non connecté';
      window.location.href = '/';
      return;
    }
    if (!(data.isModerator || data.isWhitelisted)) {
      window.location.href = '/no-access';
      return;
    }
    userInfo.innerHTML = `<img class="pdp" src="${data.profileImage}" alt="pdp"/> ${data.displayName}`;
  }).catch(err => console.error(err));

  // Envoi de message (exemple futur: endpoint /api/chat/send)
  const sendBtn = document.getElementById('sendBtn');
  sendBtn?.addEventListener('click', () => {
    const val = document.getElementById('msgInput').value.trim();
    const result = document.getElementById('sendResult');
    if (!val) return;
    fetch('/api/chat/send', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ message: val }) })
      .then(r=>r.json())
      .then(d => {
        result.textContent = d.ok ? 'Message envoyé' : 'Échec envoi';
      })
      .catch(()=> result.textContent = 'Erreur réseau');
  });

  // Gestion des commandes
  const listEl = document.getElementById('commandsList');
  if (listEl) {
    loadCommands();
  }

  function loadCommands() {
    fetch('/api/commands').then(r => {
      if (!r.ok) throw new Error('forbidden');
      return r.json();
    }).then(cmds => {
      if (!Array.isArray(cmds) || cmds.length === 0) {
        listEl.textContent = 'Aucune commande trouvée';
        return;
      }
      listEl.innerHTML = '';
      cmds.forEach(c => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '.5rem';
        const name = document.createElement('code');
        name.textContent = c.name;
        const btn = document.createElement('button');
        btn.textContent = c.enabled ? 'Disable' : 'Enable';
        btn.style.minWidth = '70px';
        btn.addEventListener('click', () => toggleCommand(c.name, btn));
        const status = document.createElement('span');
        status.textContent = c.enabled ? 'ON' : 'OFF';
        status.style.color = c.enabled ? '#4caf50' : '#f44336';
        row.appendChild(name);
        row.appendChild(btn);
        row.appendChild(status);
        listEl.appendChild(row);
      });
    }).catch(() => {
      listEl.textContent = 'Erreur chargement commandes';
    });
  }

  function toggleCommand(name, btn) {
    btn.disabled = true;
    fetch(`/api/commands/${encodeURIComponent(name)}/toggle`, { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        if (d && typeof d.enabled !== 'undefined') {
          btn.textContent = d.enabled ? 'Disable' : 'Enable';
          const statusEl = btn.nextSibling;
          if (statusEl) {
            statusEl.textContent = d.enabled ? 'ON' : 'OFF';
            statusEl.style.color = d.enabled ? '#4caf50' : '#f44336';
          }
        }
      })
      .catch(() => {})
      .finally(() => btn.disabled = false);
  }
});
