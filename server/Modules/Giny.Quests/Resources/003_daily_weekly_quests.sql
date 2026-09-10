CREATE TABLE IF NOT EXISTS `quest_templates` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `Code` VARCHAR(96) NOT NULL,
  `Name` VARCHAR(160) NOT NULL,
  `DescriptionTemplate` TEXT NOT NULL,
  `QuestPeriod` VARCHAR(16) NOT NULL,
  `ObjectiveType` VARCHAR(64) NOT NULL,
  `Category` VARCHAR(32) NOT NULL,
  `MinPlayerLevel` INT NOT NULL,
  `MaxPlayerLevel` INT NOT NULL,
  `TargetAmount` INT NOT NULL,
  `TargetEntityId` BIGINT NULL,
  `TargetFamilyId` BIGINT NULL,
  `TargetZoneId` BIGINT NULL,
  `TargetDungeonId` BIGINT NULL,
  `TargetResourceId` BIGINT NULL,
  `TargetRecipeId` BIGINT NULL,
  `TargetPokefusRarity` VARCHAR(32) NULL,
  `Parameters` LONGTEXT NOT NULL DEFAULT '{}',
  `Weight` INT NOT NULL DEFAULT 100,
  `Enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UX_quest_templates_code` (`Code`),
  KEY `IX_quest_templates_pool` (`QuestPeriod`,`MinPlayerLevel`,`MaxPlayerLevel`,`Enabled`),
  KEY `IX_quest_templates_objective` (`ObjectiveType`,`Enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quest_rewards` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `TemplateId` BIGINT NOT NULL,
  `RewardType` VARCHAR(32) NOT NULL,
  `Amount` BIGINT NOT NULL,
  `ItemId` INT NULL,
  `Parameters` LONGTEXT NOT NULL DEFAULT '{}',
  `DisplayOrder` INT NOT NULL DEFAULT 0,
  `Enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UX_quest_rewards_template_type` (`TemplateId`,`RewardType`),
  KEY `IX_quest_rewards_template` (`TemplateId`,`Enabled`),
  CONSTRAINT `FK_quest_rewards_template` FOREIGN KEY (`TemplateId`) REFERENCES `quest_templates` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `player_quests` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `PlayerId` BIGINT NOT NULL,
  `TemplateId` BIGINT NOT NULL,
  `Period` VARCHAR(16) NOT NULL,
  `PeriodKey` VARCHAR(16) NOT NULL,
  `ObjectiveType` VARCHAR(64) NOT NULL,
  `Category` VARCHAR(32) NOT NULL,
  `Title` VARCHAR(180) NOT NULL,
  `Description` TEXT NOT NULL,
  `TargetAmount` INT NOT NULL,
  `CurrentAmount` INT NOT NULL DEFAULT 0,
  `TargetEntityId` BIGINT NULL,
  `TargetFamilyId` BIGINT NULL,
  `TargetZoneId` BIGINT NULL,
  `TargetDungeonId` BIGINT NULL,
  `TargetResourceId` BIGINT NULL,
  `TargetRecipeId` BIGINT NULL,
  `TargetPokefusRarity` VARCHAR(32) NULL,
  `Parameters` LONGTEXT NOT NULL DEFAULT '{}',
  `Completed` TINYINT(1) NOT NULL DEFAULT 0,
  `CompletedAt` DATETIME NULL,
  `RewardClaimed` TINYINT(1) NOT NULL DEFAULT 0,
  `RewardClaimedAt` DATETIME NULL,
  `GeneratedAt` DATETIME NOT NULL,
  `ExpiresAt` DATETIME NOT NULL,
  `SlotNumber` INT NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UX_player_quests_period_slot` (`PlayerId`,`Period`,`PeriodKey`,`SlotNumber`),
  UNIQUE KEY `UX_player_quests_period_template` (`PlayerId`,`PeriodKey`,`TemplateId`),
  KEY `IX_player_quests_active` (`PlayerId`,`Period`,`PeriodKey`,`Completed`),
  KEY `IX_player_quests_claim` (`PlayerId`,`Completed`,`RewardClaimed`,`ExpiresAt`),
  CONSTRAINT `FK_player_quests_template` FOREIGN KEY (`TemplateId`) REFERENCES `quest_templates` (`Id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `player_quest_rewards` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `PlayerQuestId` BIGINT NOT NULL,
  `RewardType` VARCHAR(32) NOT NULL,
  `Amount` BIGINT NOT NULL,
  `ItemId` INT NULL,
  `Parameters` LONGTEXT NOT NULL DEFAULT '{}',
  `DisplayOrder` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`Id`),
  KEY `IX_player_quest_rewards_quest` (`PlayerQuestId`,`DisplayOrder`),
  CONSTRAINT `FK_player_quest_rewards_quest` FOREIGN KEY (`PlayerQuestId`) REFERENCES `player_quests` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `player_battle_pass_progress` (
  `PlayerId` BIGINT NOT NULL,
  `Experience` BIGINT NOT NULL DEFAULT 0,
  `UpdatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`PlayerId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `quest_templates`
(`Code`,`Name`,`DescriptionTemplate`,`QuestPeriod`,`ObjectiveType`,`Category`,`MinPlayerLevel`,`MaxPlayerLevel`,`TargetAmount`,`TargetEntityId`,`TargetFamilyId`,`TargetZoneId`,`TargetDungeonId`,`TargetResourceId`,`TargetRecipeId`,`TargetPokefusRarity`,`Parameters`,`Weight`,`Enabled`)
SELECT
  CONCAT('D', LPAD(b.MinLevel,3,'0'), '_', a.Suffix),
  a.Name,
  a.Description,
  'DAILY',
  a.ObjectiveType,
  a.Category,
  b.MinLevel,
  b.MaxLevel,
  CASE a.ObjectiveType
    WHEN 'KILL_MONSTERS' THEN ELT(b.BracketIndex + 1,15,20,30,40,50,60,70,80,90,100)
    WHEN 'KILL_MONSTER_FAMILY' THEN ELT(b.BracketIndex + 1,10,10,15,20,25,30,35,40,45,50)
    WHEN 'KILL_SPECIFIC_MONSTER' THEN ELT(b.BracketIndex + 1,5,5,10,10,10,15,15,20,20,20)
    WHEN 'KILL_BOSS' THEN ELT(b.BracketIndex + 1,1,1,1,1,2,2,2,2,3,3)
    WHEN 'WIN_FIGHTS' THEN ELT(b.BracketIndex + 1,5,5,10,10,10,15,15,20,20,20)
    WHEN 'COMPLETE_DUNGEONS' THEN ELT(b.BracketIndex + 1,1,1,1,2,2,2,2,3,3,3)
    WHEN 'COMPLETE_SPECIFIC_DUNGEON' THEN ELT(b.BracketIndex + 1,1,1,1,1,1,2,2,2,2,2)
    WHEN 'CAPTURE_POKEFUS' THEN ELT(b.BracketIndex + 1,1,1,1,2,2,2,3,3,3,3)
    WHEN 'CAPTURE_POKEFUS_RARITY' THEN ELT(b.BracketIndex + 1,1,1,1,1,1,1,2,2,2,2)
    WHEN 'FIGHT_WITH_POKEFUS' THEN ELT(b.BracketIndex + 1,5,5,5,10,10,15,15,20,20,20)
    WHEN 'HARVEST_RESOURCES' THEN ELT(b.BracketIndex + 1,20,30,50,75,100,100,125,150,150,150)
    WHEN 'CRAFT_ITEMS' THEN ELT(b.BracketIndex + 1,5,5,10,10,15,15,20,20,25,30)
    WHEN 'COMPLETE_CHALLENGES' THEN ELT(b.BracketIndex + 1,5,5,5,10,10,15,15,20,20,20)
  END,
  NULL,NULL,NULL,NULL,NULL,NULL,
  CASE WHEN a.ObjectiveType = 'CAPTURE_POKEFUS_RARITY' THEN 'COMMON' ELSE NULL END,
  a.Parameters,
  a.Weight,
  1
FROM
(
  SELECT 0 BracketIndex, 1 MinLevel, 20 MaxLevel UNION ALL
  SELECT 1,21,40 UNION ALL SELECT 2,41,60 UNION ALL SELECT 3,61,80 UNION ALL
  SELECT 4,81,100 UNION ALL SELECT 5,101,120 UNION ALL SELECT 6,121,140 UNION ALL
  SELECT 7,141,160 UNION ALL SELECT 8,161,180 UNION ALL SELECT 9,181,200
) b
CROSS JOIN
(
  SELECT 'KILL' Suffix,'Chasseur infatigable' Name,'Éliminez {amount} monstres.' Description,'KILL_MONSTERS' ObjectiveType,'COMBAT' Category,'{}' Parameters,120 Weight UNION ALL
  SELECT 'FAMILY','Nettoyage de la zone','Éliminez {amount} monstres de la famille de {target}.','KILL_MONSTER_FAMILY','COMBAT','{"dynamicTarget":"MONSTER_FAMILY"}',95 UNION ALL
  SELECT 'SPECIMEN','Chasseur de spécimens','Éliminez {amount} {target}.','KILL_SPECIFIC_MONSTER','COMBAT','{"dynamicTarget":"MONSTER"}',90 UNION ALL
  SELECT 'BOSS','Tête d’affiche','Terrassez {target} {amount} fois.','KILL_BOSS','COMBAT','{"dynamicTarget":"BOSS"}',75 UNION ALL
  SELECT 'FIGHTS','Pas de repos pour les héros','Remportez {amount} combats PvM.','WIN_FIGHTS','COMBAT','{}',115 UNION ALL
  SELECT 'DUNGEONS','Amateur de donjons','Terminez {amount} donjons.','COMPLETE_DUNGEONS','DUNGEON','{}',90 UNION ALL
  SELECT 'DUNGEON','{target}','Terminez {target} {amount} fois.','COMPLETE_SPECIFIC_DUNGEON','DUNGEON','{"dynamicTarget":"DUNGEON"}',80 UNION ALL
  SELECT 'CAPTURE','Collectionneur de Pokéfus','Capturez {amount} Pokéfus.','CAPTURE_POKEFUS','POKEFUS','{}',90 UNION ALL
  SELECT 'RARITY','Semaine du collectionneur','Capturez {amount} Pokéfus communs.','CAPTURE_POKEFUS_RARITY','POKEFUS','{}',70 UNION ALL
  SELECT 'PTEAM','Dresseur en action','Terminez {amount} combats victorieux avec un Pokéfus actif.','FIGHT_WITH_POKEFUS','POKEFUS','{}',85 UNION ALL
  SELECT 'HARVEST','La récolte du jour','Récoltez {amount} ressources.','HARVEST_RESOURCES','PROFESSION','{}',100 UNION ALL
  SELECT 'CRAFT','Artisan du jour','Fabriquez {amount} objets.','CRAFT_ITEMS','PROFESSION','{}',100 UNION ALL
  SELECT 'CHALLENGES','Honneur au défi','Réussissez {amount} challenges de combat.','COMPLETE_CHALLENGES','CHALLENGE','{}',85
) a;

INSERT IGNORE INTO `quest_templates`
(`Code`,`Name`,`DescriptionTemplate`,`QuestPeriod`,`ObjectiveType`,`Category`,`MinPlayerLevel`,`MaxPlayerLevel`,`TargetAmount`,`TargetEntityId`,`TargetFamilyId`,`TargetZoneId`,`TargetDungeonId`,`TargetResourceId`,`TargetRecipeId`,`TargetPokefusRarity`,`Parameters`,`Weight`,`Enabled`)
SELECT
  CONCAT('W', LPAD(b.MinLevel,3,'0'), '_', a.Suffix),
  a.Name,
  a.Description,
  'WEEKLY',
  a.ObjectiveType,
  a.Category,
  b.MinLevel,
  b.MaxLevel,
  CASE a.ObjectiveType
    WHEN 'KILL_MONSTERS' THEN ELT(b.BracketIndex + 1,100,150,250,350,400)
    WHEN 'KILL_MONSTER_FAMILY' THEN ELT(b.BracketIndex + 1,50,75,100,150,200)
    WHEN 'KILL_SPECIFIC_MONSTER' THEN ELT(b.BracketIndex + 1,20,30,40,50,60)
    WHEN 'KILL_BOSS' THEN ELT(b.BracketIndex + 1,3,5,7,10,10)
    WHEN 'WIN_FIGHTS' THEN ELT(b.BracketIndex + 1,20,30,40,50,60)
    WHEN 'COMPLETE_DUNGEONS' THEN ELT(b.BracketIndex + 1,5,8,10,15,15)
    WHEN 'COMPLETE_SPECIFIC_DUNGEON' THEN ELT(b.BracketIndex + 1,3,5,7,10,10)
    WHEN 'CAPTURE_POKEFUS' THEN ELT(b.BracketIndex + 1,5,10,10,15,20)
    WHEN 'CAPTURE_POKEFUS_RARITY' THEN ELT(b.BracketIndex + 1,2,3,4,5,5)
    WHEN 'FIGHT_WITH_POKEFUS' THEN ELT(b.BracketIndex + 1,15,25,35,45,50)
    WHEN 'HARVEST_RESOURCES' THEN ELT(b.BracketIndex + 1,150,200,300,400,450)
    WHEN 'CRAFT_ITEMS' THEN ELT(b.BracketIndex + 1,30,50,70,90,100)
    WHEN 'COMPLETE_CHALLENGES' THEN ELT(b.BracketIndex + 1,10,15,20,25,30)
  END,
  NULL,NULL,NULL,NULL,NULL,NULL,
  CASE WHEN a.ObjectiveType = 'CAPTURE_POKEFUS_RARITY' THEN 'COMMON' ELSE NULL END,
  a.Parameters,
  a.Weight,
  1
FROM
(
  SELECT 0 BracketIndex, 1 MinLevel, 40 MaxLevel UNION ALL
  SELECT 1,41,80 UNION ALL SELECT 2,81,120 UNION ALL SELECT 3,121,160 UNION ALL SELECT 4,161,200
) b
CROSS JOIN
(
  SELECT 'KILL' Suffix,'Grande chasse' Name,'Éliminez {amount} monstres cette semaine.' Description,'KILL_MONSTERS' ObjectiveType,'COMBAT' Category,'{}' Parameters,120 Weight UNION ALL
  SELECT 'FAMILY','Traque familiale','Éliminez {amount} monstres de la famille de {target}.','KILL_MONSTER_FAMILY','COMBAT','{"dynamicTarget":"MONSTER_FAMILY"}',95 UNION ALL
  SELECT 'SPECIMEN','Spécimens recherchés','Éliminez {amount} {target}.','KILL_SPECIFIC_MONSTER','COMBAT','{"dynamicTarget":"MONSTER"}',90 UNION ALL
  SELECT 'BOSS','Tableau de chasse','Terrassez {target} {amount} fois.','KILL_BOSS','COMBAT','{"dynamicTarget":"BOSS"}',80 UNION ALL
  SELECT 'FIGHTS','Combattant de la semaine','Remportez {amount} combats PvM.','WIN_FIGHTS','COMBAT','{}',115 UNION ALL
  SELECT 'DUNGEONS','Tour des donjons','Terminez {amount} donjons.','COMPLETE_DUNGEONS','DUNGEON','{}',95 UNION ALL
  SELECT 'DUNGEON','{target}','Terminez {target} {amount} fois.','COMPLETE_SPECIFIC_DUNGEON','DUNGEON','{"dynamicTarget":"DUNGEON"}',85 UNION ALL
  SELECT 'CAPTURE','Grande collection Pokéfus','Capturez {amount} Pokéfus.','CAPTURE_POKEFUS','POKEFUS','{}',90 UNION ALL
  SELECT 'RARITY','Pokéfus triés sur le volet','Capturez {amount} Pokéfus communs.','CAPTURE_POKEFUS_RARITY','POKEFUS','{}',70 UNION ALL
  SELECT 'PTEAM','Compagnons de route','Terminez {amount} combats victorieux avec un Pokéfus actif.','FIGHT_WITH_POKEFUS','POKEFUS','{}',85 UNION ALL
  SELECT 'HARVEST','Réserves de la semaine','Récoltez {amount} ressources.','HARVEST_RESOURCES','PROFESSION','{}',100 UNION ALL
  SELECT 'CRAFT','Commande artisanale','Fabriquez {amount} objets.','CRAFT_ITEMS','PROFESSION','{}',100 UNION ALL
  SELECT 'CHALLENGES','Défis à la chaîne','Réussissez {amount} challenges de combat.','COMPLETE_CHALLENGES','CHALLENGE','{}',85
) a;

INSERT IGNORE INTO `quest_rewards`
(`TemplateId`,`RewardType`,`Amount`,`ItemId`,`Parameters`,`DisplayOrder`,`Enabled`)
SELECT `Id`, 'KAMAS',
       CASE WHEN `QuestPeriod`='DAILY' THEN 1000 + (`MaxPlayerLevel` * 120) ELSE 8000 + (`MaxPlayerLevel` * 500) END,
       NULL, '{}', 1, 1
FROM `quest_templates`;

INSERT IGNORE INTO `quest_rewards`
(`TemplateId`,`RewardType`,`Amount`,`ItemId`,`Parameters`,`DisplayOrder`,`Enabled`)
SELECT `Id`, 'BATTLE_PASS_XP',
       CASE WHEN `QuestPeriod`='DAILY' THEN 100 + (`MaxPlayerLevel` DIV 20) * 20 ELSE 450 + (`MaxPlayerLevel` DIV 40) * 100 END,
       NULL, '{}', 2, 1
FROM `quest_templates`;
