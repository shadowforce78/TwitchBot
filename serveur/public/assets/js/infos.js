// Infos Page JavaScript - FAQ

// Toggle FAQ
function toggleFaq(button) {
    const faqItem = button.closest('.faq-item');
    const allItems = document.querySelectorAll('.faq-item');
    
    // Fermer tous les autres items
    allItems.forEach(item => {
        if (item !== faqItem && item.classList.contains('active')) {
            item.classList.remove('active');
        }
    });
    
    // Toggle l'item cliqué
    faqItem.classList.toggle('active');
}

// handleLogout() et submitSuggestion() sont définis dans common.js

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
