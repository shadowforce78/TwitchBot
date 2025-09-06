// Remplacez par vos valeurs
const TWITCH_CLIENT_ID = 'pktjvdmiwtsiydxpnfgg6i57gv9y0x'; // à mettre à jour
const REDIRECT_URI = window.location.origin + '/';
const SCOPES = ['user:read:email'].join(' ');

document.addEventListener('DOMContentLoaded', function() {
  var loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.onclick = function() {
      var clientId = 'pktjvdmiwtsiydxpnfgg6i57gv9y0x'; // Mets ici ton vrai client_id Twitch
      var redirectUri = window.location.origin + '/';
      var scopes = 'user:read:email';
      var url = 'https://id.twitch.tv/oauth2/authorize'
        + '?client_id=' + encodeURIComponent(clientId)
        + '&redirect_uri=' + encodeURIComponent(redirectUri)
        + '&response_type=code'
        + '&scope=' + encodeURIComponent(scopes);
      window.location.href = url;
    };
  }
});
