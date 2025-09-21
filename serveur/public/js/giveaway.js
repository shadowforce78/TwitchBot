document.addEventListener('DOMContentLoaded', async () => {
    let currentUser = null;
    let giveaways = [];
    let isAdmin = false;

    // Vérifier l'authentification
    async function checkAuth() {
        try {
            const response = await fetch('/api/auth/check');
            const data = await response.json();
            
            if (data.authenticated) {
                currentUser = data.user;
                isAdmin = data.isWhitelisted || data.isBroadcaster;
                
                const userInfo = document.getElementById('userInfo');
                if (userInfo) {
                    userInfo.textContent = currentUser.display_name || currentUser.login;
                }
                
                if (isAdmin) {
                    const adminSection = document.getElementById('admin-section');
                    if (adminSection) {
                        adminSection.style.display = 'block';
                    }
                }
            }
        } catch (error) {
            console.error('Erreur lors de la vérification de l\'authentification:', error);
        }
    }

    // Charger les giveaways actifs
    async function loadGiveaways() {
        try {
            const response = await fetch('/api/giveaways');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            giveaways = data;
            displayGiveaways();
        } catch (error) {
            console.error('Erreur lors du chargement des giveaways:', error);
            const container = document.getElementById('active-giveaways');
            if (container) {
                container.innerHTML = '<div class="error">Erreur lors du chargement des giveaways</div>';
            }
        }
    }

    // Afficher les giveaways
    function displayGiveaways() {
        const container = document.getElementById('active-giveaways');
        if (!container) return;
        
        if (giveaways.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h4>Aucun giveaway actif</h4>
                    <p>Il n'y a actuellement aucun giveaway en cours.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = giveaways.map(giveaway => {
            const isParticipating = giveaway.is_participating;
            const canParticipate = (giveaway.state || giveaway.status) === 'ouvert' && currentUser;
            const participantCount = giveaway.participant_count || giveaway.nb_participants || 0;
            const giveawayStatus = giveaway.state || giveaway.status || 'inconnu';
            const giveawayTitle = giveaway.titre || giveaway.title || 'Titre manquant';

            return `
                <div class="giveaway-card" data-id="${giveaway.id}">
                    <div class="giveaway-header">
                        <h3 class="giveaway-title">${escapeHtml(giveawayTitle)}</h3>
                        <span class="giveaway-status status-${giveawayStatus}">${giveawayStatus.toUpperCase()}</span>
                    </div>
                    
                    ${(giveaway.image || giveaway.image_url) ? `<img src="${escapeHtml(giveaway.image || giveaway.image_url)}" alt="${escapeHtml(giveawayTitle)}" class="giveaway-image">` : ''}
                    
                    <div class="giveaway-description">
                        ${escapeHtml(giveaway.description || 'Aucune description')}
                    </div>
                    
                    <div class="giveaway-details">
                        <div class="detail-item">
                            <span>👥</span>
                            <span class="detail-value">${participantCount} participant${participantCount > 1 ? 's' : ''}</span>
                        </div>
                        <div class="detail-item">
                            <span>🕒</span>
                            <span class="detail-value">${formatDate(giveaway.created_at)}</span>
                        </div>
                        ${giveaway.prix ? `
                        <div class="detail-item">
                            <span>🎁</span>
                            <span class="detail-value">${escapeHtml(giveaway.prix)}</span>
                        </div>
                        ` : ''}
                        ${giveaway.cashprize && giveaway.cashprize > 0 ? `
                        <div class="detail-item">
                            <span>💰</span>
                            <span class="detail-value">${giveaway.cashprize}€</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="giveaway-actions">
                        <div class="participation-info">
                            ${isParticipating ? '✅ Vous participez' : ''}
                        </div>
                        
                        <div style="display: flex; gap: 10px;">
                            ${canParticipate ? `
                                ${!isParticipating ? 
                                    `<button class="btn-participate" onclick="participateInGiveaway(${giveaway.id})">Participer</button>` : 
                                    `<button class="btn-leave" onclick="leaveGiveaway(${giveaway.id})">Quitter</button>`
                                }
                            ` : ''}
                            
                            ${isAdmin ? `
                                <button class="btn-secondary" onclick="closeGiveaway(${giveaway.id})">Fermer</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Participer à un giveaway
    window.participateInGiveaway = async function(giveawayId) {
        if (!currentUser) {
            alert('Vous devez être connecté pour participer');
            return;
        }

        try {
            const response = await fetch(`/api/giveaways/${giveawayId}/participate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (response.ok) {
                showNotification('Participation enregistrée avec succès !', 'success');
                await loadGiveaways(); // Recharger pour mettre à jour l'état
            } else {
                showNotification(data.message || 'Erreur lors de la participation', 'error');
            }
        } catch (error) {
            console.error('Erreur lors de la participation:', error);
            showNotification('Erreur lors de la participation', 'error');
        }
    };

    // Quitter un giveaway
    window.leaveGiveaway = async function(giveawayId) {
        if (!currentUser) {
            return;
        }

        try {
            const response = await fetch(`/api/giveaways/${giveawayId}/leave`, {
                method: 'DELETE'
            });

            const data = await response.json();
            
            if (response.ok) {
                showNotification('Vous avez quitté le giveaway', 'success');
                await loadGiveaways(); // Recharger pour mettre à jour l'état
            } else {
                showNotification(data.message || 'Erreur lors de l\'annulation', 'error');
            }
        } catch (error) {
            console.error('Erreur lors de l\'annulation:', error);
            showNotification('Erreur lors de l\'annulation', 'error');
        }
    };

    // Fermer un giveaway (admin)
    window.closeGiveaway = async function(giveawayId) {
        if (!isAdmin) {
            showNotification('Accès non autorisé', 'error');
            return;
        }

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
                await loadGiveaways(); // Recharger pour mettre à jour l'état
            } else {
                showNotification(data.message || 'Erreur lors de la fermeture', 'error');
            }
        } catch (error) {
            console.error('Erreur lors de la fermeture:', error);
            showNotification('Erreur lors de la fermeture', 'error');
        }
    };

    // Créer un nouveau giveaway (admin)
    const createForm = document.getElementById('create-giveaway-form-element');
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!isAdmin) {
                showNotification('Accès non autorisé', 'error');
                return;
            }

            const formData = new FormData(createForm);
            const giveawayData = {
                titre: formData.get('title'),
                description: formData.get('description'),
                image: formData.get('image_url') || null,
                prix: formData.get('prize') || null,
                nb_reward: parseInt(formData.get('nb_rewards')) || 1,
                cashprize: parseFloat(formData.get('cashprize')) || 0.00,
                date_tirage: formData.get('date_tirage') || null
            };

            try {
                const response = await fetch('/api/giveaways', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(giveawayData)
                });

                const data = await response.json();
                
                if (response.ok) {
                    showNotification('Giveaway créé avec succès !', 'success');
                    createForm.reset();
                    hideCreateGiveawayForm(); // Fermer le formulaire
                    await loadGiveaways(); // Recharger la liste
                } else {
                    showNotification(data.message || 'Erreur lors de la création', 'error');
                }
            } catch (error) {
                console.error('Erreur lors de la création:', error);
                showNotification('Erreur lors de la création', 'error');
            }
        });
    }

    // Fonctions utilitaires
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

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

    function showNotification(message, type = 'info') {
        // Créer ou réutiliser le conteneur de notifications
        let notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
            `;
            document.body.appendChild(notificationContainer);
        }

        // Créer la notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            padding: 12px 20px;
            margin-bottom: 10px;
            border-radius: 6px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            transform: translateX(300px);
            transition: all 0.3s ease;
        `;
        notification.textContent = message;

        notificationContainer.appendChild(notification);

        // Animation d'entrée
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);

        // Supprimer après 3 secondes
        setTimeout(() => {
            notification.style.transform = 'translateX(300px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Fonctions pour gérer l'affichage du formulaire de création
    window.showCreateGiveawayForm = function() {
        const form = document.getElementById('create-giveaway-form');
        if (form) {
            form.style.display = 'block';
            // S'assurer que les champs sont vides et que les placeholders sont corrects
            const formElement = document.getElementById('create-giveaway-form-element');
            if (formElement) {
                formElement.reset();
                // Nettoyer explicitement tous les champs pour éviter les valeurs null
                const inputs = formElement.querySelectorAll('input, textarea');
                inputs.forEach(input => {
                    if (input.type !== 'submit' && input.type !== 'button') {
                        if (input.name === 'nb_rewards') {
                            input.value = '1';
                        } else if (input.type !== 'number') {
                            input.value = '';
                        } else if (input.name === 'cashprize') {
                            input.value = '';
                        }
                    }
                });
            }
        }
    };

    window.hideCreateGiveawayForm = function() {
        const form = document.getElementById('create-giveaway-form');
        if (form) {
            form.style.display = 'none';
        }
    };

    // Initialisation
    await checkAuth();
    await loadGiveaways();

    // Rafraîchissement automatique toutes les 30 secondes
    setInterval(loadGiveaways, 30000);
});