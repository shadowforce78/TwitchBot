# 🐳 TwitchBot Docker Setup

## 📋 Prérequis

- Docker & Docker Compose installés
- Un réseau nginx-proxy configuré (ou adapter le `docker-compose.yml`)
- Certificats SSL via Let's Encrypt (si utilisation du proxy)

## 🚀 Installation

### 1. Configuration de l'environnement

Copier le fichier d'exemple et le personnaliser :

```bash
cp .env.example .env
```

Éditer `.env` avec tes credentials :
- **Twitch Bot** : username, oauth token, channel
- **Twitch API** : client_id, client_secret
- **Database** : mot de passe MySQL
- **Session** : secret key sécurisé

### 2. Build & Lancement

```bash
# Build des images
docker-compose build

# Lancer les services
docker-compose up -d

# Vérifier les logs
docker-compose logs -f
```

### 3. Vérification

```bash
# Status des conteneurs
docker-compose ps

# Logs du backend (bot + serveur)
docker-compose logs -f twitchbot-backend

# Logs du frontend
docker-compose logs -f twitchbot-frontend

# Logs MySQL
docker-compose logs -f mysql
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         nginx-proxy (externe)           │
│    (gère SSL + reverse proxy)           │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
        ▼                    ▼
┌──────────────┐    ┌──────────────────┐
│   Frontend   │    │     Backend      │
│   (nginx)    │    │  (bot + server)  │
│   Port 80    │    │    Port 3003     │
└──────────────┘    └────────┬─────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │     MySQL      │
                    │   Port 3306    │
                    └────────────────┘
```

## 📁 Services

### `twitchbot-backend`
- **Rôle** : Exécute le bot Twitch ET le serveur Express
- **Port** : 3003
- **Volumes** :
  - `./data` → données persistantes (command-state.json)
  - `./logs` → logs applicatifs
- **Dépendances** : MySQL

### `twitchbot-frontend`
- **Rôle** : Sert le site web Astro via nginx
- **Port** : 80
- **Build** : Multi-stage (build Astro + runtime nginx)

### `mysql`
- **Rôle** : Base de données pour les giveaways, users, passes
- **Port** : 3306
- **Volume** : `mysql-data` (persistance)

## 🔧 Commandes utiles

### Gestion des services

```bash
# Arrêter tous les services
docker-compose down

# Arrêter et supprimer les volumes
docker-compose down -v

# Redémarrer un service spécifique
docker-compose restart twitchbot-backend

# Rebuild après modification du code
docker-compose up -d --build
```

### Débogage

```bash
# Accéder au shell du backend
docker-compose exec twitchbot-backend sh

# Accéder au MySQL
docker-compose exec mysql mysql -u twitchbot -p

# Voir les logs en temps réel
docker-compose logs -f --tail=100 twitchbot-backend

# Inspecter la santé des conteneurs
docker-compose ps
docker inspect twitchbot-backend
```

### Base de données

```bash
# Backup de la BDD
docker-compose exec mysql mysqldump -u root -p u379386034_giveaway > backup.sql

# Restaurer un backup
docker-compose exec -T mysql mysql -u root -p u379386034_giveaway < backup.sql

# Accéder au shell MySQL
docker-compose exec mysql mysql -u twitchbot -p u379386034_giveaway
```

## 🌐 URLs de production

- **Frontend** : https://twitchbot.saumondeluxe.com
- **Backend API** : https://api.twitchbot.saumondeluxe.com
- **Health Check** : https://api.twitchbot.saumondeluxe.com/health

## 🔐 Sécurité

- Modifie `SESSION_SECRET` dans `.env` (génère un token aléatoire)
- Modifie `DB_PASSWORD` (mot de passe fort)
- Les fichiers `.env` sont exclus du Git (`.gitignore`)
- Le réseau `proxy-tier` isole les services
- Health checks configurés pour monitoring

## 📊 Monitoring

### Health Checks

Le backend inclut un health check :

```bash
curl http://localhost:3003/health
```

Si tu utilises Docker Swarm ou Kubernetes, les health checks sont déjà configurés dans les Dockerfiles.

### Logs

Les logs sont disponibles via :
- `docker-compose logs -f` (tous les services)
- Volume `/app/logs` dans le backend
- Nginx access/error logs dans le frontend

## 🔄 Mise à jour

```bash
# 1. Pull les dernières modifications
git pull

# 2. Rebuild les images
docker-compose build

# 3. Redémarrer avec les nouvelles images
docker-compose up -d

# 4. Vérifier que tout fonctionne
docker-compose ps
docker-compose logs -f
```

## 🐛 Troubleshooting

### Le bot ne se connecte pas
```bash
# Vérifier les logs
docker-compose logs twitchbot-backend | grep -i "error\|warning"

# Vérifier les variables d'env
docker-compose exec twitchbot-backend env | grep TWITCH
```

### Erreur de connexion MySQL
```bash
# Vérifier que MySQL est démarré
docker-compose ps mysql

# Tester la connexion
docker-compose exec twitchbot-backend sh
# Puis dans le container :
nc -zv mysql 3306
```

### Le frontend ne charge pas
```bash
# Vérifier les logs nginx
docker-compose logs twitchbot-frontend

# Reconstruire le frontend
docker-compose up -d --build twitchbot-frontend
```

## 🎯 Variables d'environnement importantes

| Variable | Description | Exemple |
|----------|-------------|---------|
| `TWITCH_BOT_USERNAME` | Nom du bot | `kiwibot` |
| `TWITCH_OAUTH_TOKEN` | Token OAuth | `oauth:abc123...` |
| `TWITCH_CHANNEL` | Canal Twitch | `shadowforce78` |
| `DB_HOST` | Host MySQL | `mysql` (nom du service) |
| `DB_PASSWORD` | Mot de passe BDD | `SuperSecure123!` |
| `SESSION_SECRET` | Secret sessions | `random-secure-string` |

## 📝 Notes

- Le backend lance **à la fois** le bot Twitch (`src/index.js`) et le serveur web (`serveur/index.js`)
- Les deux processus tournent dans le même conteneur (via `sh -c "node src/index.js & node serveur/index.js"`)
- Si tu préfères séparer bot et serveur, crée deux services distincts dans `docker-compose.yml`
- Le réseau `proxy-tier` doit être créé au préalable si tu utilises nginx-proxy

Enjoy ! 🚀
