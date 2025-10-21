// Homepage JavaScript
let currentSlide = 0;

// Carrousel
function nextSlide() {
    const track = document.getElementById('carousel-track');
    const cards = track.children;
    const cardWidth = cards[0].offsetWidth + 32; // width + gap
    
    if (currentSlide < cards.length - 3) {
        currentSlide++;
        track.style.transform = `translateX(-${currentSlide * cardWidth}px)`;
    }
}

function prevSlide() {
    const track = document.getElementById('carousel-track');
    const cards = track.children;
    const cardWidth = cards[0].offsetWidth + 32;
    
    if (currentSlide > 0) {
        currentSlide--;
        track.style.transform = `translateX(-${currentSlide * cardWidth}px)`;
    }
}

// Charger les derniers giveaways (2 derniers terminés)
async function loadRecentGiveaways() {
    try {
        const response = await fetch('/api/giveaways');
        if (!response.ok) throw new Error('Erreur lors du chargement');
        
        const giveaways = await response.json();
        const endedGiveaways = giveaways
            .filter(g => g.state === 'ferme' || g.status === 'ended')
            .filter(g => g.winner_twitch_id) // Seulement ceux avec un gagnant
            .sort((a, b) => new Date(b.date_tirage || b.end_date) - new Date(a.date_tirage || a.end_date))
            .slice(0, 2);
        
        displayRecentGiveaways(endedGiveaways);
    } catch (error) {
        console.error('Erreur:', error);
        document.getElementById('recent-giveaways').innerHTML = '<p class="text-center">Aucun historique disponible</p>';
    }
}

function displayRecentGiveaways(giveaways) {
    const container = document.getElementById('recent-giveaways');
    
    if (giveaways.length === 0) {
        container.innerHTML = '<p class="text-center">Aucun giveaway terminé pour le moment</p>';
        return;
    }
    
    container.innerHTML = giveaways.map(g => `
        <div class="recent-giveaway-card">
            <div class="recent-giveaway-header">
                <h3 class="recent-giveaway-title">${escapeHtml(g.titre || g.title || 'Sans titre')}</h3>
                <span class="recent-giveaway-reward">${escapeHtml(g.prix || g.reward || 'Prix mystère')}</span>
            </div>
            <div class="recent-giveaway-body">
                <div class="recent-info-row">
                    <span>📅</span>
                    <span>Tiré le ${formatDate(g.date_tirage || g.end_date)}</span>
                </div>
                <div class="recent-info-row">
                    <span>👥</span>
                    <span>${g.participant_count || 0} participant(s)</span>
                </div>
                ${g.winner_username ? `
                    <div class="recent-winner">
                        <span>🏆</span>
                        <span>Gagnant : ${escapeHtml(g.winner_username)}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Soumission de suggestion
async function submitSuggestion(event) {
    event.preventDefault();
    
    const textarea = document.getElementById('suggestion-text');
    const suggestion = textarea.value.trim();
    
    if (!suggestion) {
        showNotification('Veuillez entrer une suggestion', 'error');
        return;
    }
    
    try {
        // Pour l'instant, on simule l'envoi (à connecter à une vraie API plus tard)
        showNotification('Merci pour votre suggestion ! 💡', 'success');
        textarea.value = '';
    } catch (error) {
        showNotification('Erreur lors de l\'envoi', 'error');
    }
}

// handleLogout() est défini dans common.js

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    loadRecentGiveaways();
    checkAuth();
});
