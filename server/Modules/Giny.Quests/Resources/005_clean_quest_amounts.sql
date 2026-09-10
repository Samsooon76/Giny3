UPDATE `quest_templates`
SET `TargetAmount` = CASE `ObjectiveType`
  WHEN 'KILL_MONSTERS' THEN IF(`QuestPeriod`='DAILY', ELT(((`MinPlayerLevel`-1) DIV 20)+1,15,20,30,40,50,60,70,80,90,100), ELT(((`MinPlayerLevel`-1) DIV 40)+1,100,150,250,350,400))
  WHEN 'KILL_MONSTER_FAMILY' THEN IF(`QuestPeriod`='DAILY', ELT(((`MinPlayerLevel`-1) DIV 20)+1,10,10,15,20,25,30,35,40,45,50), ELT(((`MinPlayerLevel`-1) DIV 40)+1,50,75,100,150,200))
  WHEN 'KILL_SPECIFIC_MONSTER' THEN IF(`QuestPeriod`='DAILY', ELT(((`MinPlayerLevel`-1) DIV 20)+1,5,5,10,10,10,15,15,20,20,20), ELT(((`MinPlayerLevel`-1) DIV 40)+1,20,30,40,50,60))
  WHEN 'KILL_BOSS' THEN IF(`QuestPeriod`='DAILY', ELT(((`MinPlayerLevel`-1) DIV 20)+1,1,1,1,1,2,2,2,2,3,3), ELT(((`MinPlayerLevel`-1) DIV 40)+1,3,5,7,10,10))
  WHEN 'WIN_FIGHTS' THEN IF(`QuestPeriod`='DAILY', ELT(((`MinPlayerLevel`-1) DIV 20)+1,5,5,10,10,10,15,15,20,20,20), ELT(((`MinPlayerLevel`-1) DIV 40)+1,20,30,40,50,60))
  WHEN 'COMPLETE_DUNGEONS' THEN IF(`QuestPeriod`='DAILY', ELT(((`MinPlayerLevel`-1) DIV 20)+1,1,1,1,2,2,2,2,3,3,3), ELT(((`MinPlayerLevel`-1) DIV 40)+1,5,8,10,15,15))
  WHEN 'COMPLETE_SPECIFIC_DUNGEON' THEN IF(`QuestPeriod`='DAILY', ELT(((`MinPlayerLevel`-1) DIV 20)+1,1,1,1,1,1,2,2,2,2,2), ELT(((`MinPlayerLevel`-1) DIV 40)+1,3,5,7,10,10))
  WHEN 'CAPTURE_POKEFUS' THEN IF(`QuestPeriod`='DAILY', ELT(((`MinPlayerLevel`-1) DIV 20)+1,1,1,1,2,2,2,3,3,3,3), ELT(((`MinPlayerLevel`-1) DIV 40)+1,5,10,10,15,20))
  WHEN 'CAPTURE_POKEFUS_RARITY' THEN IF(`QuestPeriod`='DAILY', ELT(((`MinPlayerLevel`-1) DIV 20)+1,1,1,1,1,1,1,2,2,2,2), ELT(((`MinPlayerLevel`-1) DIV 40)+1,2,3,4,5,5))
  WHEN 'FIGHT_WITH_POKEFUS' THEN IF(`QuestPeriod`='DAILY', ELT(((`MinPlayerLevel`-1) DIV 20)+1,5,5,5,10,10,15,15,20,20,20), ELT(((`MinPlayerLevel`-1) DIV 40)+1,15,25,35,45,50))
  WHEN 'HARVEST_RESOURCES' THEN IF(`QuestPeriod`='DAILY', ELT(((`MinPlayerLevel`-1) DIV 20)+1,20,30,50,75,100,100,125,150,150,150), ELT(((`MinPlayerLevel`-1) DIV 40)+1,150,200,300,400,450))
  WHEN 'CRAFT_ITEMS' THEN IF(`QuestPeriod`='DAILY', ELT(((`MinPlayerLevel`-1) DIV 20)+1,5,5,10,10,15,15,20,20,25,30), ELT(((`MinPlayerLevel`-1) DIV 40)+1,30,50,70,90,100))
  WHEN 'COMPLETE_CHALLENGES' THEN IF(`QuestPeriod`='DAILY', ELT(((`MinPlayerLevel`-1) DIV 20)+1,5,5,5,10,10,15,15,20,20,20), ELT(((`MinPlayerLevel`-1) DIV 40)+1,10,15,20,25,30))
  ELSE `TargetAmount`
END,
`Name` = CASE
  WHEN `Name` IN ('Destination : {target}','Destination donjon') THEN 'Destination : donjon'
  WHEN `Name` IN ('Expédition : {target}','Expédition donjon') THEN 'Expédition : donjon'
  ELSE `Name`
END
WHERE `Enabled` = 1;

UPDATE `player_quests` pq
INNER JOIN `quest_templates` t ON t.`Id` = pq.`TemplateId`
SET
  pq.`Description` = CASE
    WHEN pq.`TargetAmount` <> t.`TargetAmount`
    THEN REPLACE(
      pq.`Description`,
      CONCAT(CONVERT(CAST(pq.`TargetAmount` AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci, ' '),
      CONCAT(CONVERT(CAST(t.`TargetAmount` AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci, ' '))
    ELSE pq.`Description`
  END,
  pq.`Title` = CASE
    WHEN pq.`Title` COLLATE utf8mb4_unicode_ci LIKE 'Destination%' THEN 'Destination : donjon'
    WHEN pq.`Title` COLLATE utf8mb4_unicode_ci LIKE 'Expédition%' THEN 'Expédition : donjon'
    WHEN pq.`TargetAmount` <> t.`TargetAmount`
    THEN REPLACE(
      pq.`Title`,
      CONCAT(CONVERT(CAST(pq.`TargetAmount` AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci, ' '),
      CONCAT(CONVERT(CAST(t.`TargetAmount` AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci, ' '))
    ELSE pq.`Title`
  END,
  pq.`TargetAmount` = t.`TargetAmount`
WHERE pq.`RewardClaimed` = 0
  AND (
    pq.`TargetAmount` <> t.`TargetAmount`
    OR pq.`Title` COLLATE utf8mb4_unicode_ci LIKE 'Destination :%'
    OR pq.`Title` COLLATE utf8mb4_unicode_ci LIKE 'Expédition :%'
  );

UPDATE `player_quests`
SET `Description` = REPLACE(`Description` COLLATE utf8mb4_unicode_ci, ' 3 fois', ' 2 fois')
WHERE `RewardClaimed` = 0
  AND `ObjectiveType` = 'COMPLETE_SPECIFIC_DUNGEON'
  AND `TargetAmount` = 2
  AND `Description` COLLATE utf8mb4_unicode_ci LIKE '% 3 fois%';
