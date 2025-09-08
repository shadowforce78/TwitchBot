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
});
