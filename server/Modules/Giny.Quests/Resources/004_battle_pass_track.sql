SET @bp_vip_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'player_battle_pass_progress'
    AND COLUMN_NAME = 'Vip'
);
SET @bp_vip_sql := IF(
  @bp_vip_exists = 0,
  'ALTER TABLE `player_battle_pass_progress` ADD COLUMN `Vip` TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE bp_vip_stmt FROM @bp_vip_sql;
EXECUTE bp_vip_stmt;
DEALLOCATE PREPARE bp_vip_stmt;

CREATE TABLE IF NOT EXISTS `battle_pass_seasons` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `Code` VARCHAR(32) NOT NULL,
  `Name` VARCHAR(80) NOT NULL,
  `StartsAt` DATETIME NOT NULL,
  `EndsAt` DATETIME NOT NULL,
  `ExperiencePerLevel` INT NOT NULL DEFAULT 1000,
  `LevelCount` INT NOT NULL DEFAULT 20,
  `Enabled` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UX_battle_pass_seasons_code` (`Code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `battle_pass_rewards` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `SeasonId` BIGINT NOT NULL,
  `Level` INT NOT NULL,
  `Track` VARCHAR(8) NOT NULL,
  `RewardType` VARCHAR(32) NOT NULL,
  `Amount` BIGINT NOT NULL,
  `ItemId` INT NULL,
  `Label` VARCHAR(120) NOT NULL,
  `ShortLabel` VARCHAR(24) NOT NULL,
  `DisplayOrder` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UX_battle_pass_rewards_slot` (`SeasonId`,`Level`,`Track`,`DisplayOrder`),
  KEY `IX_battle_pass_rewards_season` (`SeasonId`,`Level`,`Track`),
  CONSTRAINT `FK_battle_pass_rewards_season` FOREIGN KEY (`SeasonId`) REFERENCES `battle_pass_seasons` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `player_battle_pass_claims` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `PlayerId` BIGINT NOT NULL,
  `SeasonId` BIGINT NOT NULL,
  `Level` INT NOT NULL,
  `Track` VARCHAR(8) NOT NULL,
  `ClaimedAt` DATETIME NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UX_player_battle_pass_claims` (`PlayerId`,`SeasonId`,`Level`,`Track`),
  KEY `IX_player_battle_pass_claims_player` (`PlayerId`,`SeasonId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `battle_pass_seasons`
(`Code`,`Name`,`StartsAt`,`EndsAt`,`ExperiencePerLevel`,`LevelCount`,`Enabled`)
VALUES
('S1','Saison 1','2026-08-01 00:00:00','2026-11-30 23:59:59',1000,20,1);

INSERT IGNORE INTO `battle_pass_rewards`
(`SeasonId`,`Level`,`Track`,`RewardType`,`Amount`,`ItemId`,`Label`,`ShortLabel`,`DisplayOrder`)
SELECT s.Id, r.Level, r.Track, r.RewardType, r.Amount, r.ItemId, r.Label, r.ShortLabel, 0
FROM `battle_pass_seasons` s
JOIN (
  SELECT 1 Level,'FREE' Track,'KAMAS' RewardType,5000 Amount,12124 ItemId,'5 000 kamas' Label,'5k' ShortLabel UNION ALL
  SELECT 2,'FREE','PLAYER_XP',2000,680,'2 000 XP','2k XP' UNION ALL
  SELECT 3,'FREE','KAMAS',7500,12124,'7 500 kamas','7.5k' UNION ALL
  SELECT 4,'FREE','ITEM',50,311,'50 × Eau','Eau ×50' UNION ALL
  SELECT 5,'FREE','KAMAS',15000,12124,'15 000 kamas','15k' UNION ALL
  SELECT 6,'FREE','PLAYER_XP',4000,680,'4 000 XP','4k XP' UNION ALL
  SELECT 7,'FREE','KAMAS',10000,12124,'10 000 kamas','10k' UNION ALL
  SELECT 8,'FREE','ITEM',80,303,'80 × Bois de Frêne','Frêne ×80' UNION ALL
  SELECT 9,'FREE','KAMAS',20000,12124,'20 000 kamas','20k' UNION ALL
  SELECT 10,'FREE','KAMAS',25000,12124,'25 000 kamas','25k' UNION ALL
  SELECT 11,'FREE','PLAYER_XP',5000,680,'5 000 XP','5k XP' UNION ALL
  SELECT 12,'FREE','ITEM',40,312,'40 × Fer','Fer ×40' UNION ALL
  SELECT 13,'FREE','KAMAS',30000,12124,'30 000 kamas','30k' UNION ALL
  SELECT 14,'FREE','PLAYER_XP',6000,680,'6 000 XP','6k XP' UNION ALL
  SELECT 15,'FREE','KAMAS',50000,12124,'50 000 kamas','50k' UNION ALL
  SELECT 16,'FREE','ITEM',80,311,'80 × Eau','Eau ×80' UNION ALL
  SELECT 17,'FREE','KAMAS',40000,12124,'40 000 kamas','40k' UNION ALL
  SELECT 18,'FREE','PLAYER_XP',8000,680,'8 000 XP','8k XP' UNION ALL
  SELECT 19,'FREE','KAMAS',60000,12124,'60 000 kamas','60k' UNION ALL
  SELECT 20,'FREE','KAMAS',100000,12124,'100 000 kamas','100k' UNION ALL
  SELECT 1,'VIP','KAMAS',15000,12124,'15 000 kamas','15k' UNION ALL
  SELECT 2,'VIP','PLAYER_XP',8000,680,'8 000 XP','8k XP' UNION ALL
  SELECT 3,'VIP','KAMAS',25000,12124,'25 000 kamas','25k' UNION ALL
  SELECT 4,'VIP','ITEM',200,311,'200 × Eau','Eau ×200' UNION ALL
  SELECT 5,'VIP','KAMAS',50000,12124,'50 000 kamas','50k' UNION ALL
  SELECT 6,'VIP','PLAYER_XP',15000,680,'15 000 XP','15k XP' UNION ALL
  SELECT 7,'VIP','KAMAS',35000,12124,'35 000 kamas','35k' UNION ALL
  SELECT 8,'VIP','ITEM',200,303,'200 × Bois de Frêne','Frêne ×200' UNION ALL
  SELECT 9,'VIP','KAMAS',60000,12124,'60 000 kamas','60k' UNION ALL
  SELECT 10,'VIP','ITEM',1,31001,'1 × Filet Pokéfus','Filet' UNION ALL
  SELECT 11,'VIP','PLAYER_XP',20000,680,'20 000 XP','20k XP' UNION ALL
  SELECT 12,'VIP','ITEM',150,312,'150 × Fer','Fer ×150' UNION ALL
  SELECT 13,'VIP','KAMAS',80000,12124,'80 000 kamas','80k' UNION ALL
  SELECT 14,'VIP','PLAYER_XP',25000,680,'25 000 XP','25k XP' UNION ALL
  SELECT 15,'VIP','KAMAS',120000,12124,'120 000 kamas','120k' UNION ALL
  SELECT 16,'VIP','ITEM',1,31005,'1 × Filet Pokéfus','Filet' UNION ALL
  SELECT 17,'VIP','KAMAS',100000,12124,'100 000 kamas','100k' UNION ALL
  SELECT 18,'VIP','PLAYER_XP',30000,680,'30 000 XP','30k XP' UNION ALL
  SELECT 19,'VIP','KAMAS',150000,12124,'150 000 kamas','150k' UNION ALL
  SELECT 20,'VIP','KAMAS',250000,12124,'250 000 kamas','250k'
) r
WHERE s.Code = 'S1';
