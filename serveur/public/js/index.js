document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      window.location.href = '/login';
    });
  }
  // Optionnel: appeler /api/me pour afficher état connecté
  fetch('/api/me').then(r=>r.json()).then(data => {
    if (data.loggedIn) {
      const btn = document.getElementById('loginBtn');
      if (btn) btn.textContent = data.displayName;
    }
  }).catch(()=>{});
});
