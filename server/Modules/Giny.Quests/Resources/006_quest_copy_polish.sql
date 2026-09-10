UPDATE `quest_templates`
SET `Name` = CASE
  WHEN `Name` IN ('Destination donjon','Destination : {target}') THEN 'Destination : donjon'
  WHEN `Name` IN ('Expédition donjon','Expédition : {target}') THEN 'Expédition : donjon'
  ELSE `Name`
END
WHERE `ObjectiveType` = 'COMPLETE_SPECIFIC_DUNGEON';

UPDATE `player_quests`
SET `Title` = CASE
  WHEN `Title` COLLATE utf8mb4_unicode_ci LIKE 'Destination%' THEN 'Destination : donjon'
  WHEN `Title` COLLATE utf8mb4_unicode_ci LIKE 'Expédition%' THEN 'Expédition : donjon'
  ELSE `Title`
END
WHERE `ObjectiveType` = 'COMPLETE_SPECIFIC_DUNGEON'
  AND `RewardClaimed` = 0;

UPDATE `player_quests`
SET `Description` = REPLACE(
  `Description` COLLATE utf8mb4_unicode_ci,
  'Terminez Donjon',
  'Terminez le Donjon')
WHERE `ObjectiveType` = 'COMPLETE_SPECIFIC_DUNGEON'
  AND `RewardClaimed` = 0
  AND `Description` COLLATE utf8mb4_unicode_ci LIKE 'Terminez Donjon%';
