UPDATE `quest_templates`
SET `Name` = '{target}'
WHERE `ObjectiveType` = 'COMPLETE_SPECIFIC_DUNGEON';

UPDATE `player_quests`
SET `Title` = TRIM(TRAILING '.' FROM TRIM(
  REPLACE(
    REPLACE(
      REPLACE(`Description` COLLATE utf8mb4_unicode_ci, 'Terminez le ', ''),
      'Terminez ',
      ''),
    CONCAT(' ', CAST(`TargetAmount` AS CHAR), ' fois'),
    '')))
WHERE `ObjectiveType` = 'COMPLETE_SPECIFIC_DUNGEON'
  AND `RewardClaimed` = 0
  AND (
    `Title` COLLATE utf8mb4_unicode_ci LIKE 'Destination%'
    OR `Title` COLLATE utf8mb4_unicode_ci LIKE 'Expédition%'
    OR `Title` = '{target}'
  );
