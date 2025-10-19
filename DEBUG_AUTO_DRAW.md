# 🔧 Guide de Débogage - Système Auto-Draw

## Problème : Le système auto-draw ne fonctionne pas

### ✅ Étapes de diagnostic

#### 1. Vérifier que le serveur démarre correctement

Lancer le serveur et vérifier les logs :
```bash
npm start
```

Vous devriez voir :
```
[serveur] Serveur web démarré sur http://localhost:3003
[Auto-Draw] Système de tirage automatique démarré (vérification toutes les minutes)
[Auto-Draw] Vérification des giveaways en cours...
[Auto-Draw] 0 giveaway(s) à tirer au sort trouvé(s)
[Auto-Draw] Vérification terminée
```

#### 2. Exécuter le script de test

```bash
node scripts/test-auto-draw.js
```

Ce script affichera :
- ✅ Tous les giveaways dans la base de données
- ✅ Les giveaways actifs avec date de tirage
- ✅ Les giveaways prêts à être tirés
- ✅ L'heure du serveur MySQL vs Node.js
- ✅ Les participants de chaque giveaway

**Points à vérifier :**
- La date de tirage est-elle dans le passé ?
- L'heure du serveur MySQL correspond-elle à l'heure actuelle ?
- Y a-t-il des participants ?
- Le giveaway est-il bien à l'état "ouvert" ?

#### 3. Tester manuellement via l'interface admin

1. Aller sur `/admin`
2. Cliquer sur le bouton **"🔄 Tester Auto-Draw"**
3. Vérifier les logs de la console serveur

#### 4. Vérifier la base de données

```sql
-- Voir tous les giveaways
SELECT * FROM giveaway;

-- Voir les giveaways qui devraient être tirés
SELECT g.*, COUNT(p.user_id) as participant_count
FROM giveaway g
LEFT JOIN giveaway_participants p ON g.id = p.giveaway_id
WHERE g.state = 'ouvert' 
AND g.date_tirage IS NOT NULL 
AND g.date_tirage <= NOW()
GROUP BY g.id;

-- Vérifier l'heure du serveur MySQL
SELECT NOW() as heure_actuelle;
```

### 🐛 Problèmes courants

#### Problème 1 : Aucun giveaway trouvé
**Cause :** La date de tirage est dans le futur ou NULL

**Solution :**
```sql
-- Vérifier la date
SELECT id, titre, date_tirage, NOW() as maintenant 
FROM giveaway 
WHERE state = 'ouvert';

-- Mettre une date dans le passé pour tester
UPDATE giveaway 
SET date_tirage = DATE_SUB(NOW(), INTERVAL 1 MINUTE) 
WHERE id = 1;
```

#### Problème 2 : Fuseau horaire incorrect
**Cause :** Le serveur MySQL est dans un fuseau horaire différent

**Solution :**
```sql
-- Vérifier le fuseau horaire
SELECT @@global.time_zone, @@session.time_zone, NOW();

-- Définir le fuseau horaire (exemple pour Paris UTC+1/+2)
SET time_zone = '+01:00';
-- OU
SET time_zone = 'Europe/Paris';
```

Dans le fichier `.env`, vous pouvez aussi ajouter :
```
TZ=Europe/Paris
```

#### Problème 3 : Pas de participants
**Cause :** Le giveaway n'a aucun participant

**Solution :**
```sql
-- Vérifier les participants
SELECT * FROM giveaway_participants WHERE giveaway_id = 1;

-- Ajouter un participant de test
INSERT INTO giveaway_participants (giveaway_id, user_id) 
VALUES (1, 'test_user_id');
```

#### Problème 4 : Le serveur ne démarre pas le système
**Cause :** Erreur lors du démarrage

**Vérifications :**
1. Regarder les logs d'erreur au démarrage
2. Vérifier que la connexion à la base de données fonctionne
3. Vérifier que le module `axios` est installé : `npm install axios`

#### Problème 5 : Les logs n'apparaissent pas
**Cause :** Le serveur n'est pas lancé via `serveur/index.js`

**Solution :**
Assurez-vous de lancer le serveur web :
```bash
node serveur/index.js
```
Ou si vous utilisez `src/index.js` (bot Twitch), vérifier qu'il appelle bien :
```javascript
const webServer = require('./serveur/index');
webServer.start();
```

### 📊 Logs à surveiller

#### Logs normaux (système fonctionne)
```
[Auto-Draw] Vérification des giveaways en cours...
[Auto-Draw] 1 giveaway(s) à tirer au sort trouvé(s)
[Auto-Draw] Tirage automatique pour le giveaway #1: Mon Giveaway
[Auto-Draw] Date de tirage: 2025-10-19T10:00:00.000Z, Maintenant: 2025-10-19T10:01:00.000Z
[Auto-Draw] 5 participant(s) pour le giveaway #1
[Auto-Draw] Gagnant tiré au sort: username123 pour le giveaway #1
[Discord] Notification tirage envoyée pour le giveaway #1
[Auto-Draw] Vérification terminée
```

#### Logs d'erreur
```
[Auto-Draw] Erreur lors de la vérification des giveaways: [détails]
```
→ Vérifier la connexion à la base de données

```
[Discord] Erreur envoi webhook: [détails]
```
→ Le tirage a eu lieu, mais Discord n'a pas reçu la notification (webhook invalide ?)

### 🧪 Test complet

Pour tester le système de bout en bout :

1. **Créer un giveaway de test** avec une date dans 2 minutes
2. **Ajouter au moins 1 participant**
3. **Attendre 2 minutes**
4. **Vérifier les logs** → Le tirage devrait se faire automatiquement
5. **Vérifier Discord** → Une notification devrait apparaître

Ou pour tester immédiatement :

```sql
-- Créer un giveaway qui expire maintenant
UPDATE giveaway 
SET date_tirage = DATE_SUB(NOW(), INTERVAL 1 SECOND) 
WHERE id = 1 AND state = 'ouvert';
```

Puis cliquer sur "🔄 Tester Auto-Draw" dans l'interface admin.

### 📞 Support

Si le problème persiste après toutes ces vérifications :

1. Exécuter `node scripts/test-auto-draw.js` et copier le résultat
2. Vérifier les logs du serveur pendant 2-3 minutes
3. Copier les logs pertinents
4. Vérifier la structure de la table `giveaway` :
```sql
DESCRIBE giveaway;
```

Ces informations permettront d'identifier le problème exact.
