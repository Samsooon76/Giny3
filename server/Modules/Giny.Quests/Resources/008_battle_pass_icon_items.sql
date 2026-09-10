UPDATE `battle_pass_rewards`
SET `ItemId` = 12124
WHERE `RewardType` = 'KAMAS'
  AND (`ItemId` IS NULL OR `ItemId` = 0);

UPDATE `battle_pass_rewards`
SET `ItemId` = 680
WHERE `RewardType` = 'PLAYER_XP'
  AND (`ItemId` IS NULL OR `ItemId` = 0);
