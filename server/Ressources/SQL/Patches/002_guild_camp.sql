-- Campement de guilde — schéma et dataset MVP.
-- Les INSERT IGNORE préservent les équilibrages modifiés par les administrateurs.

CREATE TABLE IF NOT EXISTS `guild_buildings` (
  `Id` bigint NOT NULL,
  `Code` varchar(64) NOT NULL,
  `Name` varchar(255) NOT NULL,
  `Description` text NOT NULL,
  `DisplayOrder` smallint NOT NULL,
  `OverlayX` smallint NOT NULL,
  `OverlayY` smallint NOT NULL,
  `OverlayWidth` smallint NOT NULL,
  `OverlayHeight` smallint NOT NULL,
  `Enabled` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UK_guild_building_code` (`Code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `guild_building_levels` (
  `Id` bigint NOT NULL,
  `BuildingId` bigint NOT NULL,
  `Level` tinyint unsigned NOT NULL,
  `KamaCost` bigint NOT NULL DEFAULT 0,
  `AssetPath` varchar(512) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UK_guild_building_level` (`BuildingId`, `Level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `guild_building_effects` (
  `Id` bigint NOT NULL,
  `BuildingLevelId` bigint NOT NULL,
  `EffectType` varchar(64) NOT NULL,
  `Value` double NOT NULL,
  `Description` varchar(512) NOT NULL,
  `Parameters` longtext NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_guild_building_effect_level` (`BuildingLevelId`),
  KEY `IX_guild_building_effect_type` (`EffectType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `guild_building_level_requirements` (
  `Id` bigint NOT NULL,
  `BuildingLevelId` bigint NOT NULL,
  `ItemId` int NOT NULL,
  `RequiredQuantity` int NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UK_guild_level_requirement` (`BuildingLevelId`, `ItemId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `guild_building_states` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `GuildId` bigint NOT NULL,
  `BuildingId` bigint NOT NULL,
  `Level` tinyint unsigned NOT NULL DEFAULT 1,
  `UpdatedAt` datetime NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UK_guild_building_state` (`GuildId`, `BuildingId`),
  KEY `IX_guild_building_state_guild` (`GuildId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `guild_projects` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `GuildId` bigint NOT NULL,
  `BuildingId` bigint NOT NULL,
  `TargetLevel` tinyint unsigned NOT NULL,
  `Status` varchar(32) NOT NULL DEFAULT 'ACTIVE',
  `KamasContributed` bigint NOT NULL DEFAULT 0,
  `CreatedAt` datetime NOT NULL,
  `CompletedAt` datetime DEFAULT NULL,
  `CompletedByCharacterId` bigint DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UK_guild_project_target` (`GuildId`, `BuildingId`, `TargetLevel`),
  KEY `IX_guild_project_active` (`GuildId`, `Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `guild_project_requirements` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `ProjectId` bigint NOT NULL,
  `ItemId` int NOT NULL,
  `RequiredQuantity` int NOT NULL,
  `ContributedQuantity` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UK_guild_project_requirement` (`ProjectId`, `ItemId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `guild_project_contributions` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `ProjectId` bigint NOT NULL,
  `CharacterId` bigint NOT NULL,
  `ContributionType` varchar(16) NOT NULL,
  `ItemId` int DEFAULT NULL,
  `Quantity` bigint NOT NULL,
  `CreatedAt` datetime NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_guild_contribution_project` (`ProjectId`, `CreatedAt`),
  KEY `IX_guild_contribution_character` (`CharacterId`, `CreatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT IGNORE INTO `guild_buildings`
  (`Id`,`Code`,`Name`,`Description`,`DisplayOrder`,`OverlayX`,`OverlayY`,`OverlayWidth`,`OverlayHeight`,`Enabled`)
VALUES
  (1,'GUILD_HALL','Hall de guilde','Le cœur administratif du campement et de ses réserves.',1,323,30,251,200,1),
  (2,'FORGE','Forge','Un atelier commun qui réduit la quantité de ressources consommée lors des crafts.',2,113,181,217,177,1),
  (3,'POKEFUS_LAB','Laboratoire Pokéfus','Un laboratoire consacré à la progression et à l’activation des Pokéfus.',3,528,174,236,190,1);

-- Overlays extraits du mockup 1124×510 fourni (même valeurs que le client).
UPDATE `guild_buildings` SET `OverlayX`=323, `OverlayY`=30,  `OverlayWidth`=251, `OverlayHeight`=200 WHERE `Id`=1 AND `Code`='GUILD_HALL';
UPDATE `guild_buildings` SET `OverlayX`=113, `OverlayY`=181, `OverlayWidth`=217, `OverlayHeight`=177 WHERE `Id`=2 AND `Code`='FORGE';
UPDATE `guild_buildings` SET `OverlayX`=528, `OverlayY`=174, `OverlayWidth`=236, `OverlayHeight`=190 WHERE `Id`=3 AND `Code`='POKEFUS_LAB';

INSERT IGNORE INTO `guild_building_levels` (`Id`,`BuildingId`,`Level`,`KamaCost`,`AssetPath`) VALUES
  (101,1,1,0,'Giny_GuildCamp/assets/buildings/hall-1.png'),
  (102,1,2,250000,'Giny_GuildCamp/assets/buildings/hall-2.png'),
  (103,1,3,750000,'Giny_GuildCamp/assets/buildings/hall-3.png'),
  (201,2,1,0,'Giny_GuildCamp/assets/buildings/forge-1.png'),
  (202,2,2,100000,'Giny_GuildCamp/assets/buildings/forge-2.png'),
  (203,2,3,500000,'Giny_GuildCamp/assets/buildings/forge-3.png'),
  (301,3,1,0,'Giny_GuildCamp/assets/buildings/laboratory-1.png'),
  (302,3,2,200000,'Giny_GuildCamp/assets/buildings/laboratory-2.png'),
  (303,3,3,600000,'Giny_GuildCamp/assets/buildings/laboratory-3.png');

INSERT IGNORE INTO `guild_building_effects`
  (`Id`,`BuildingLevelId`,`EffectType`,`Value`,`Description`,`Parameters`)
VALUES
  (1001,101,'STORAGE_BONUS',100,'Réserve de guilde : +100 emplacements','{}'),
  (1002,101,'RESOURCE_YIELD_PERCENT',2,'Récolte de ressources : +2 %','{}'),
  (1003,102,'STORAGE_BONUS',250,'Réserve de guilde : +250 emplacements','{}'),
  (1004,102,'RESOURCE_YIELD_PERCENT',5,'Récolte de ressources : +5 %','{}'),
  (1005,103,'STORAGE_BONUS',500,'Réserve de guilde : +500 emplacements','{}'),
  (1006,103,'RESOURCE_YIELD_PERCENT',10,'Récolte de ressources : +10 %','{}'),
  (1007,103,'TELEPORT_UNLOCK',1,'Téléportation vers le campement débloquée','{"destination":"guild_camp"}'),
  (2001,201,'CRAFT_COST_PERCENT',0,'Coût des crafts inchangé','{}'),
  (2002,202,'CRAFT_COST_PERCENT',-5,'Coût en ressources des crafts : -5 %','{}'),
  (2003,203,'CRAFT_COST_PERCENT',-10,'Coût en ressources des crafts : -10 %','{}'),
  (2004,203,'MARKET_TAX_PERCENT',-5,'Taxe de marché : -5 %','{}'),
  (3001,301,'POKEFUS_XP_PERCENT',5,'Expérience Pokéfus : +5 %','{}'),
  (3002,301,'POKEFUS_ACTIVATION_COST_PERCENT',0,'Coût d’activation Pokéfus inchangé','{}'),
  (3003,302,'POKEFUS_XP_PERCENT',10,'Expérience Pokéfus : +10 %','{}'),
  (3004,302,'POKEFUS_ACTIVATION_COST_PERCENT',-5,'Coût d’activation Pokéfus : -5 %','{}'),
  (3005,303,'POKEFUS_XP_PERCENT',15,'Expérience Pokéfus : +15 %','{}'),
  (3006,303,'POKEFUS_ACTIVATION_COST_PERCENT',-10,'Coût d’activation Pokéfus : -10 %','{}');

-- Objets Dofus 2.73 : 303 Bois de Frêne, 312 Fer, 311 Eau.
INSERT IGNORE INTO `guild_building_level_requirements`
  (`Id`,`BuildingLevelId`,`ItemId`,`RequiredQuantity`)
VALUES
  (1,102,303,100), (2,103,303,250), (3,103,312,100),
  (4,202,312,10),  (5,203,312,100), (6,203,303,150),
  (7,302,311,30),  (8,303,311,80),  (9,303,312,40);
