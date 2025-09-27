-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1:3306
-- Généré le : sam. 27 sep. 2025 à 13:36
-- Version du serveur : 11.8.3-MariaDB-log
-- Version de PHP : 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `u379386034_giveaway`
--

-- --------------------------------------------------------

--
-- Structure de la table `giveaway`
--

CREATE TABLE `giveaway` (
  `id` int(11) NOT NULL,
  `titre` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `image` varchar(500) DEFAULT NULL,
  `prix` varchar(255) DEFAULT NULL,
  `nb_reward` int(11) DEFAULT 1,
  `cashprize` decimal(10,2) DEFAULT 0.00,
  `nb_participants` int(11) DEFAULT 0,
  `state` enum('ouvert','ferme') DEFAULT 'ouvert',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `date_tirage` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `giveaway`
--

INSERT INTO `giveaway` (`id`, `titre`, `description`, `image`, `prix`, `nb_reward`, `cashprize`, `nb_participants`, `state`, `created_at`, `date_tirage`) VALUES
(3, 'Nitro', 'Nitro discord', 'https://www.republic-of-gamers.fr/wp-content/uploads/2025/09/Avantages-minimaux-impact-maximum-comme-Discord-utilise-Nitro-pour-nourrir.webp.webp', 'Nitro Discord', 2, 20.00, 0, 'ouvert', '2025-09-21 18:46:37', '2025-09-23 10:00:00');

-- --------------------------------------------------------

--
-- Structure de la table `giveaway_participants`
--

CREATE TABLE `giveaway_participants` (
  `giveaway_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `pass`
--

CREATE TABLE `pass` (
  `id` int(11) NOT NULL,
  `id_twitch` int(11) NOT NULL,
  `valide` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `pass`
--

INSERT INTO `pass` (`id`, `id_twitch`, `valide`) VALUES
(6, 423479054, 1),
(7, 554177101, 1);

-- --------------------------------------------------------

--
-- Structure de la table `user`
--

CREATE TABLE `user` (
  `id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `id_twitch` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `user`
--

INSERT INTO `user` (`id`, `username`, `id_twitch`) VALUES
(6, 'levraisaumondeluxe', 423479054),
(7, 'kiwitfb', 554177101);

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `giveaway`
--
ALTER TABLE `giveaway`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `giveaway_participants`
--
ALTER TABLE `giveaway_participants`
  ADD PRIMARY KEY (`giveaway_id`,`user_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Index pour la table `pass`
--
ALTER TABLE `pass`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_twitch` (`id_twitch`);

--
-- Index pour la table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `id_twitch` (`id_twitch`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `giveaway`
--
ALTER TABLE `giveaway`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT pour la table `pass`
--
ALTER TABLE `pass`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT pour la table `user`
--
ALTER TABLE `user`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `giveaway_participants`
--
ALTER TABLE `giveaway_participants`
  ADD CONSTRAINT `giveaway_participants_ibfk_1` FOREIGN KEY (`giveaway_id`) REFERENCES `giveaway` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `giveaway_participants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `user` (`id_twitch`) ON DELETE CASCADE;

--
-- Contraintes pour la table `pass`
--
ALTER TABLE `pass`
  ADD CONSTRAINT `pass_ibfk_1` FOREIGN KEY (`id_twitch`) REFERENCES `user` (`id_twitch`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
