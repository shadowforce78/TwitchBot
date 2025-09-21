const mysql = require("mysql2/promise");

class DatabaseManager {
    constructor() {
        this.pool = null;
    }

    async init() {
        if (this.pool) return;

        try {
            this.pool = mysql.createPool({
                host: process.env.DB_HOST || "localhost",
                port: process.env.DB_PORT || 3306,
                user: process.env.DB_USER || "root",
                password: process.env.DB_PASSWORD || "",
                database: process.env.DB_NAME || "u379386034_giveaway",
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
            });

            console.log("[database] Connexion MySQL initialisée");
        } catch (error) {
            console.error("[database] Erreur connexion MySQL:", error);
            throw error;
        }
    }

    async query(sql, params = []) {
        if (!this.pool) await this.init();
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (error) {
            console.error("[database] Erreur requête:", error);
            throw error;
        }
    }

    // Méthodes pour les giveaways
    async getActiveGiveaways() {
        return await this.query(
            "SELECT * FROM giveaway WHERE state = 'ouvert' ORDER BY created_at DESC"
        );
    }

    async getGiveawayById(id) {
        const results = await this.query("SELECT * FROM giveaway WHERE id = ?", [
            id,
        ]);
        return results[0] || null;
    }

    async createGiveaway(data) {
        // Support des deux types d'appels
        let titre, description, image, prix, nb_reward, cashprize, date_tirage;
        
        if (typeof data === 'string') {
            // Appel avec paramètres séparés: createGiveaway(title, description, image_url)
            titre = arguments[0];
            description = arguments[1];
            image = arguments[2];
            // Valeurs par défaut pour les paramètres manquants
            prix = null;
            nb_reward = 1;
            cashprize = 0.00;
            date_tirage = null;
        } else {
            // Appel avec objet
            const {
                titre: _titre,
                description: _description,
                image: _image,
                prix: _prix = null,
                nb_reward: _nb_reward = 1,
                cashprize: _cashprize = 0.00,
                date_tirage: _date_tirage = null,
            } = data;
            titre = _titre;
            description = _description;
            image = _image;
            prix = _prix;
            nb_reward = _nb_reward;
            cashprize = _cashprize;
            date_tirage = _date_tirage;
        }

        const result = await this.query(
            `INSERT INTO giveaway (titre, description, image, prix, nb_reward, cashprize, date_tirage, state) VALUES (?, ?, ?, ?, ?, ?, ?, 'ouvert')`,
            [titre, description, image, prix, nb_reward, cashprize, date_tirage]
        );
        return result.insertId;
    }

    async closeGiveaway(id) {
        await this.query("UPDATE giveaway SET state = 'ferme' WHERE id = ?", [id]);
    }

    // Méthodes pour les utilisateurs
    async createOrGetUser(username, id_twitch) {
        // Vérifier si l'utilisateur existe
        let user = await this.query("SELECT * FROM user WHERE id_twitch = ?", [
            id_twitch,
        ]);

        if (user.length === 0) {
            // Créer l'utilisateur
            await this.query("INSERT INTO user (username, id_twitch) VALUES (?, ?)", [
                username,
                id_twitch,
            ]);
            user = await this.query("SELECT * FROM user WHERE id_twitch = ?", [
                id_twitch,
            ]);
        } else {
            // Mettre à jour le username au cas où il aurait changé
            await this.query("UPDATE user SET username = ? WHERE id_twitch = ?", [
                username,
                id_twitch,
            ]);
        }

        return user[0];
    }

    // Méthodes pour les participations
    async participateInGiveaway(giveaway_id, user_id_twitch) {
        try {
            await this.query(
                "INSERT INTO giveaway_participants (giveaway_id, user_id) VALUES (?, ?)",
                [giveaway_id, user_id_twitch]
            );

            // Mettre à jour le compteur de participants
            await this.query(
                "UPDATE giveaway SET nb_participants = (SELECT COUNT(*) FROM giveaway_participants WHERE giveaway_id = ?) WHERE id = ?",
                [giveaway_id, giveaway_id]
            );

            return true;
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return false; // Déjà participé
            }
            throw error;
        }
    }

    async isParticipating(giveaway_id, user_id_twitch) {
        const results = await this.query(
            "SELECT 1 FROM giveaway_participants WHERE giveaway_id = ? AND user_id = ?",
            [giveaway_id, user_id_twitch]
        );
        return results.length > 0;
    }

    async getGiveawayParticipants(giveaway_id) {
        return await this.query(
            `
      SELECT u.username, u.id_twitch 
      FROM giveaway_participants gp 
      JOIN user u ON gp.user_id = u.id_twitch 
      WHERE gp.giveaway_id = ?
    `,
            [giveaway_id]
        );
    }

    async removeParticipation(giveaway_id, user_id_twitch) {
        await this.query(
            "DELETE FROM giveaway_participants WHERE giveaway_id = ? AND user_id = ?",
            [giveaway_id, user_id_twitch]
        );

        // Mettre à jour le compteur
        await this.query(
            "UPDATE giveaway SET nb_participants = (SELECT COUNT(*) FROM giveaway_participants WHERE giveaway_id = ?) WHERE id = ?",
            [giveaway_id, giveaway_id]
        );
    }

    // Obtenir le nombre de participants pour un giveaway
    async getParticipantCount(giveaway_id) {
        const results = await this.query(
            "SELECT COUNT(*) as count FROM giveaway_participants WHERE giveaway_id = ?",
            [giveaway_id]
        );
        return results[0]?.count || 0;
    }

    // Méthodes pour les pass
    async hasValidPass(id_twitch) {
        const results = await this.query(
            "SELECT valide FROM pass WHERE id_twitch = ?",
            [id_twitch]
        );
        return results.length > 0 && results[0].valide === 1;
    }

    async grantPass(id_twitch) {
        await this.query(
            "INSERT INTO pass (id_twitch, valide) VALUES (?, 1) ON DUPLICATE KEY UPDATE valide = 1",
            [id_twitch]
        );
    }

    // Méthodes de lecture pour les tables webhook (pass et user)
    async getAllUsers(limit = 100, offset = 0) {
        return await this.query(
            "SELECT id_twitch, username FROM user ORDER BY id DESC LIMIT ? OFFSET ?",
            [limit, offset]
        );
    }

    async getUsersCount() {
        const results = await this.query("SELECT COUNT(*) as count FROM user");
        return results[0]?.count || 0;
    }

    async getAllPasses(limit = 100, offset = 0) {
        return await this.query(
            `
            SELECT p.id_twitch, p.valide, u.username 
            FROM pass p 
            LEFT JOIN user u ON p.id_twitch = u.id_twitch 
            ORDER BY p.id DESC 
            LIMIT ? OFFSET ?
        `,
            [limit, offset]
        );
    }

    async getPassesCount() {
        const results = await this.query("SELECT COUNT(*) as count FROM pass");
        return results[0]?.count || 0;
    }

    async getValidPassesCount() {
        const results = await this.query(
            "SELECT COUNT(*) as count FROM pass WHERE valide = 1"
        );
        return results[0]?.count || 0;
    }

    async getUserById(id_twitch) {
        const results = await this.query("SELECT * FROM user WHERE id_twitch = ?", [
            id_twitch,
        ]);
        return results[0] || null;
    }

    async getPassById(id_twitch) {
        const results = await this.query("SELECT * FROM pass WHERE id_twitch = ?", [
            id_twitch,
        ]);
        return results[0] || null;
    }

    // Méthodes de compatibilité et utilitaires
    async createUser(id_twitch, username, displayName = null) {
        return await this.createOrGetUser(username, id_twitch);
    }

    async addParticipation(giveaway_id, user_id_twitch) {
        return await this.participateInGiveaway(giveaway_id, user_id_twitch);
    }

    async isUserParticipating(giveaway_id, user_id_twitch) {
        return await this.isParticipating(giveaway_id, user_id_twitch);
    }

    // Méthode pour fermer la connexion
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            console.log('[database] Connexion MySQL fermée');
        }
    }
}

module.exports = DatabaseManager;
