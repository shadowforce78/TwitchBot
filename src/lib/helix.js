const axios = require('axios');

async function getAppAccessToken(clientId, clientSecret) {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials'
  });
  const { data } = await axios.post('https://id.twitch.tv/oauth2/token', params);
  return data.access_token;
}

async function getUserId(accessToken, clientId, login) {
  const { data } = await axios.get('https://api.twitch.tv/helix/users', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-Id': clientId
    },
    params: { login }
  });
  return data.data?.[0]?.id;
}

async function getStreamInfo(accessToken, clientId, userId) {
  const { data } = await axios.get('https://api.twitch.tv/helix/streams', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-Id': clientId
    },
    params: { user_id: userId }
  });
  return data.data?.[0] || null;
}

async function refreshChatToken(clientId, clientSecret, refreshToken) {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });
  const { data } = await axios.post('https://id.twitch.tv/oauth2/token', params);
  // Renvoie le nouveau access_token et refresh_token
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token
  };
}

module.exports = { getAppAccessToken, getUserId, getStreamInfo, refreshChatToken };
