const axios = require('axios');
require('dotenv').config();
/**
 * Récupère un App Access Token OAuth Twitch
 * @param {string} clientId - Client ID de l'app/bot Twitch
 * @param {string} clientSecret - Client Secret de l'app/bot Twitch
 * @returns {Promise<string>} access_token
 */
async function getTwitchAppToken(clientId, clientSecret) {
    try {
        const resp = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'client_credentials'
            }
        });

        return resp.data.access_token;
    } catch (err) {
        console.error("Erreur récupération OAuth Twitch:", err.response?.data || err.message);
        throw err;
    }
}

// Exemple d’utilisation
(async () => {
    const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
    const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

    const token = await getTwitchAppToken(CLIENT_ID, CLIENT_SECRET);
    console.log("✅ Token bot Twitch :", token);
})();
