-- Pokéfus genome — Phase 1
-- Idempotent schema and the initial Bouftou development dataset.
-- INSERT IGNORE is intentional: balancing changes made by administrators are never reset at startup.

CREATE TABLE IF NOT EXISTS `pokefus_species` (
  `Id` bigint NOT NULL,
  `MonsterId` bigint NOT NULL,
  `Name` varchar(255) NOT NULL,
  `CaptureEnabled` tinyint(1) NOT NULL DEFAULT 0,
  `CaptureRate` double NOT NULL DEFAULT 1,
  `MaximumHealthPercent` tinyint unsigned NOT NULL DEFAULT 100,
  `RequiredItemId` int DEFAULT NULL,
  `MaxActiveGenes` tinyint unsigned NOT NULL DEFAULT 4,
  `Enabled` tinyint(1) NOT NULL DEFAULT 1,
  `SpawnEligible` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UK_pokefus_species_monster` (`MonsterId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `pokefus_genome_branches` (
  `Id` bigint NOT NULL,
  `SpeciesId` bigint NOT NULL,
  `Name` varchar(255) NOT NULL,
  `DisplayOrder` smallint NOT NULL,
  `Enabled` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UK_pokefus_branch_name` (`SpeciesId`, `Name`),
  KEY `IX_pokefus_branch_species_order` (`SpeciesId`, `DisplayOrder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `pokefus_genes` (
  `Id` bigint NOT NULL,
  `SpeciesId` bigint NOT NULL,
  `BranchId` bigint NOT NULL,
  `Name` varchar(255) NOT NULL,
  `Description` text NOT NULL,
  `Tier` tinyint unsigned NOT NULL,
  `XpCost` bigint NOT NULL,
  `KamaCost` bigint NOT NULL,
  `OgrineCost` int NOT NULL,
  `PrerequisiteGeneId` bigint DEFAULT NULL,
  `IconId` int DEFAULT NULL,
  `EffectType` varchar(255) NOT NULL,
  `EffectParameters` longtext NOT NULL,
  `Enabled` tinyint(1) NOT NULL DEFAULT 1,
  `DisplayOrder` smallint NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UK_pokefus_gene_name` (`SpeciesId`, `Name`),
  KEY `IX_pokefus_gene_tree` (`SpeciesId`, `BranchId`, `DisplayOrder`),
  KEY `IX_pokefus_gene_prerequisite` (`PrerequisiteGeneId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `pokefus` (
  `Id` bigint NOT NULL,
  `CharacterId` bigint NOT NULL,
  `SpeciesId` bigint NOT NULL,
  `CharacterItemUid` int DEFAULT NULL,
  `CustomName` varchar(255) DEFAULT NULL,
  `Level` smallint NOT NULL DEFAULT 1,
  `IndividualExperience` bigint NOT NULL DEFAULT 0,
  `CapturedAt` datetime NOT NULL,
  `IsActive` tinyint(1) NOT NULL DEFAULT 0,
  `IsLegendary` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UK_pokefus_character_item` (`CharacterItemUid`),
  KEY `IX_pokefus_owner` (`CharacterId`),
  KEY `IX_pokefus_owner_species` (`CharacterId`, `SpeciesId`),
  KEY `IX_pokefus_active` (`CharacterId`, `IsActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `player_pokefus_species_progress` (
  `Id` bigint NOT NULL,
  `CharacterId` bigint NOT NULL,
  `SpeciesId` bigint NOT NULL,
  `TotalExperience` bigint NOT NULL DEFAULT 0,
  `AvailableExperience` bigint NOT NULL DEFAULT 0,
  `UpdatedAt` datetime NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UK_pokefus_progress_player_species` (`CharacterId`, `SpeciesId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `player_pokefus_researched_genes` (
  `Id` bigint NOT NULL,
  `CharacterId` bigint NOT NULL,
  `SpeciesId` bigint NOT NULL,
  `GeneId` bigint NOT NULL,
  `ResearchedAt` datetime NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UK_pokefus_research_player_gene` (`CharacterId`, `GeneId`),
  KEY `IX_pokefus_research_player_species` (`CharacterId`, `SpeciesId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `pokefus_unlocked_genes` (
  `Id` bigint NOT NULL,
  `PokefusId` bigint NOT NULL,
  `GeneId` bigint NOT NULL,
  `PaymentMethod` varchar(255) NOT NULL,
  `PaidKamas` bigint NOT NULL DEFAULT 0,
  `PaidOgrines` int NOT NULL DEFAULT 0,
  `UnlockedAt` datetime NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UK_pokefus_unlock_instance_gene` (`PokefusId`, `GeneId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `pokefus_equipped_genes` (
  `Id` bigint NOT NULL,
  `PokefusId` bigint NOT NULL,
  `GeneId` bigint NOT NULL,
  `Slot` tinyint unsigned NOT NULL,
  `EquippedAt` datetime NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UK_pokefus_equipped_instance_gene` (`PokefusId`, `GeneId`),
  UNIQUE KEY `UK_pokefus_equipped_instance_slot` (`PokefusId`, `Slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Runtime/player-owned rows use server-generated identifiers. These ALTERs are
-- intentionally idempotent and also upgrade databases created by phase 1.
ALTER TABLE `pokefus` MODIFY `Id` bigint NOT NULL AUTO_INCREMENT;
ALTER TABLE `player_pokefus_species_progress` MODIFY `Id` bigint NOT NULL AUTO_INCREMENT;
ALTER TABLE `player_pokefus_researched_genes` MODIFY `Id` bigint NOT NULL AUTO_INCREMENT;
ALTER TABLE `pokefus_unlocked_genes` MODIFY `Id` bigint NOT NULL AUTO_INCREMENT;
ALTER TABLE `pokefus_equipped_genes` MODIFY `Id` bigint NOT NULL AUTO_INCREMENT;

-- Capture rules are data, not code. Rates are probabilities in [0,1]:
-- 0.01 = 1%, 0.0001 = 0.01%, 0.50 = 50%.
CREATE TABLE IF NOT EXISTS `pokefus_capture_configuration` (
  `Id` bigint NOT NULL,
  `NormalSpawnRate` double NOT NULL DEFAULT 0.01,
  `LegendarySpawnRate` double NOT NULL DEFAULT 0.0001,
  `CaptureRate` double NOT NULL DEFAULT 0.50,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `pokefus_capture_nets` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `ItemGid` int NOT NULL,
  `MinMonsterLevel` smallint NOT NULL,
  `MaxMonsterLevel` smallint NOT NULL,
  `Enabled` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UK_pokefus_capture_net_item` (`ItemGid`),
  UNIQUE KEY `UK_pokefus_capture_net_range` (`MinMonsterLevel`, `MaxMonsterLevel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `pokefus_species`
  ADD COLUMN IF NOT EXISTS `SpawnEligible` tinyint(1) NOT NULL DEFAULT 1;
ALTER TABLE `pokefus`
  ADD COLUMN IF NOT EXISTS `IsLegendary` tinyint(1) NOT NULL DEFAULT 0;

INSERT IGNORE INTO `pokefus_capture_configuration`
  (`Id`, `NormalSpawnRate`, `LegendarySpawnRate`, `CaptureRate`)
VALUES (1, 0.01, 0.0001, 0.50);

-- Filets : renseigner ici les GID d'objets déclarés "targetable" dans les
-- données client. Aucun GID arbitraire n'est livré afin de ne pas détourner un
-- objet existant. Exemple de configuration par tranches :
-- INSERT INTO `pokefus_capture_nets`
--   (`ItemGid`, `MinMonsterLevel`, `MaxMonsterLevel`, `Enabled`)
-- VALUES
--   (<GID_FILET_1_20>, 1, 20, 1),
--   (<GID_FILET_21_40>, 21, 40, 1),
--   (<GID_FILET_41_60>, 41, 60, 1);

-- The Dofus 2.73.3.14 monster record for Bouftou is 36. Early phase-1
-- databases incorrectly used monster 101 and the legacy importer consequently
-- created a second placeholder species (1000036). Merge that placeholder into
-- the configured tree without losing shared XP or equipped instances.
DROP TEMPORARY TABLE IF EXISTS `_pokefus_bouftou_progress_migration`;
CREATE TEMPORARY TABLE `_pokefus_bouftou_progress_migration` AS
SELECT `CharacterId`, `TotalExperience`, `AvailableExperience`, `UpdatedAt`
FROM `player_pokefus_species_progress`
WHERE `SpeciesId` = 1000036;

INSERT INTO `player_pokefus_species_progress`
  (`CharacterId`, `SpeciesId`, `TotalExperience`, `AvailableExperience`, `UpdatedAt`)
SELECT `CharacterId`, 101, `TotalExperience`, `AvailableExperience`, `UpdatedAt`
FROM `_pokefus_bouftou_progress_migration`
ON DUPLICATE KEY UPDATE
  `TotalExperience` = `player_pokefus_species_progress`.`TotalExperience` + VALUES(`TotalExperience`),
  `AvailableExperience` = `player_pokefus_species_progress`.`AvailableExperience` + VALUES(`AvailableExperience`),
  `UpdatedAt` = GREATEST(`player_pokefus_species_progress`.`UpdatedAt`, VALUES(`UpdatedAt`));

DROP TEMPORARY TABLE `_pokefus_bouftou_progress_migration`;

DELETE FROM `player_pokefus_species_progress` WHERE `SpeciesId` = 1000036;
UPDATE `player_pokefus_researched_genes` SET `SpeciesId` = 101 WHERE `SpeciesId` = 1000036;
UPDATE `pokefus` SET `SpeciesId` = 101 WHERE `SpeciesId` = 1000036;
DELETE FROM `pokefus_species` WHERE `Id` = 1000036 AND `MonsterId` = 36;

INSERT INTO `pokefus_species`
  (`Id`, `MonsterId`, `Name`, `CaptureEnabled`, `CaptureRate`, `MaximumHealthPercent`, `RequiredItemId`, `MaxActiveGenes`, `Enabled`, `SpawnEligible`)
VALUES
  (101, 36, 'Bouftou', 1, 1, 100, NULL, 4, 1, 1)
ON DUPLICATE KEY UPDATE
  `MonsterId` = VALUES(`MonsterId`),
  `Name` = VALUES(`Name`),
  `CaptureEnabled` = VALUES(`CaptureEnabled`),
  `MaxActiveGenes` = VALUES(`MaxActiveGenes`),
  `Enabled` = VALUES(`Enabled`),
  `SpawnEligible` = VALUES(`SpawnEligible`);

INSERT IGNORE INTO `pokefus_genome_branches`
  (`Id`, `SpeciesId`, `Name`, `DisplayOrder`, `Enabled`)
VALUES
  (1011, 101, 'Défense', 1, 1),
  (1012, 101, 'Offensive', 2, 1),
  (1013, 101, 'Troupeau', 3, 1);

INSERT IGNORE INTO `pokefus_genes`
  (`Id`, `SpeciesId`, `BranchId`, `Name`, `Description`, `Tier`, `XpCost`, `KamaCost`, `OgrineCost`, `PrerequisiteGeneId`, `IconId`, `EffectType`, `EffectParameters`, `Enabled`, `DisplayOrder`)
VALUES
  (101001, 101, 1011, 'Laine épaisse', 'Augmente les points de vie maximum du Bouftou de 5 %.', 1, 500, 5000, 0, NULL, NULL, 'STAT_PERCENT', '{"stat":"max_health","value":5}', 1, 1),
  (101002, 101, 1011, 'Laine dense', 'Augmente toutes les résistances du Bouftou de 3 %.', 2, 1500, 25000, 0, 101001, NULL, 'RESISTANCE', '{"element":"all","value":3}', 1, 2),
  (101003, 101, 1011, 'Peau de pierre', 'Augmente les points de vie maximum du Bouftou de 10 %.', 3, 4000, 75000, 0, 101002, NULL, 'STAT_PERCENT', '{"stat":"max_health","value":10}', 1, 3),
  (101004, 101, 1011, 'Bouftou Gardien', 'Déclenche un bouclier lorsque le Bouftou est en danger.', 4, 9000, 200000, 0, 101003, NULL, 'PASSIVE_TRIGGER', '{"trigger":"health_below_percent","threshold":30,"effect":"shield","value":150}', 1, 4),

  (101005, 101, 1012, 'Charge renforcée', 'Augmente la Force du Bouftou de 20.', 1, 500, 5000, 0, NULL, NULL, 'STAT_FLAT', '{"stat":"strength","value":20}', 1, 1),
  (101006, 101, 1012, 'Cornes renforcées', 'Augmente les dommages de mêlée du Bouftou de 5 %.', 2, 1500, 25000, 0, 101005, NULL, 'SPELL_DAMAGE', '{"scope":"melee","value":5}', 1, 2),
  (101007, 101, 1012, 'Bélier', 'Augmente les dommages du sort principal du Bouftou de 10 %.', 3, 4000, 75000, 0, 101006, NULL, 'MODIFY_SPELL', '{"selector":"primary","property":"damage_percent","value":10}', 1, 3),
  (101008, 101, 1012, 'Charge royale', 'Permet une puissante charge une fois par combat.', 4, 9000, 200000, 0, 101007, NULL, 'ADD_SPELL', '{"spell_key":"bouftou_royal_charge","uses_per_fight":1}', 1, 4),

  (101009, 101, 1013, 'Instinct grégaire', 'Augmente la Vitalité du Bouftou lorsqu’un allié Pokéfus est présent.', 1, 500, 5000, 0, NULL, NULL, 'PASSIVE_TRIGGER', '{"trigger":"allied_pokefus_present","effect":"stat_flat","stat":"vitality","value":30}', 1, 1),
  (101010, 101, 1013, 'Cri du troupeau', 'Augmente temporairement la Puissance des Pokéfus alliés.', 2, 1500, 25000, 0, 101009, NULL, 'ADD_SPELL', '{"spell_key":"bouftou_herd_cry","power":50,"duration":2}', 1, 2),
  (101011, 101, 1013, 'Protection du troupeau', 'Accorde 3 % de résistance aux Pokéfus alliés.', 3, 4000, 75000, 0, 101010, NULL, 'PASSIVE_TRIGGER', '{"trigger":"fight_start","target":"allied_pokefus","effect":"resistance","element":"all","value":3}', 1, 3),
  (101012, 101, 1013, 'Alpha', 'Renforce le Bouftou pour chaque autre Pokéfus allié.', 4, 9000, 200000, 0, 101011, NULL, 'PASSIVE_TRIGGER', '{"trigger":"fight_start","per":"other_allied_pokefus","effect":"power_flat","value":20}', 1, 4);
