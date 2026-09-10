-- Dedicated Pokéfus capture orbs (GIDs 31001-31010).
-- 30001 is an official Dofus item (Parchemin d'Ogrines / type 503), so the
-- filets use a free GID range. Type 507 is the custom client "Pokéball"
-- resource category. Safe to re-run.

INSERT INTO `items`
  (`Id`, `Name`, `TypeId`, `Level`, `RealWeight`, `Cursed`, `Usable`, `Exchangeable`,
   `Price`, `Etheral`, `ItemSetId`, `Criteria`, `AppearenceId`, `DropMonsterIds`,
   `RecipeSlots`, `RecipeIds`, `Effects`, `CraftXpRatio`, `IsSaleable`, `Look`)
SELECT 31001, 'Filet Pokéfus 1-20', 507, 1, 1, `Cursed`, 0, 1, 100, `Etheral`, -1, '', 0,
       `DropMonsterIds`, 0, `RecipeIds`, `Effects`, `CraftXpRatio`, 1, `Look`
FROM `items` WHERE `Id` = 973
ON DUPLICATE KEY UPDATE
  `Name` = VALUES(`Name`), `TypeId` = VALUES(`TypeId`), `Level` = VALUES(`Level`),
  `Usable` = VALUES(`Usable`), `Exchangeable` = VALUES(`Exchangeable`), `IsSaleable` = VALUES(`IsSaleable`);

INSERT INTO `items`
  (`Id`, `Name`, `TypeId`, `Level`, `RealWeight`, `Cursed`, `Usable`, `Exchangeable`,
   `Price`, `Etheral`, `ItemSetId`, `Criteria`, `AppearenceId`, `DropMonsterIds`,
   `RecipeSlots`, `RecipeIds`, `Effects`, `CraftXpRatio`, `IsSaleable`, `Look`)
SELECT 31002, 'Filet Pokéfus 21-40', 507, 21, 1, `Cursed`, 0, 1, 200, `Etheral`, -1, '', 0,
       `DropMonsterIds`, 0, `RecipeIds`, `Effects`, `CraftXpRatio`, 1, `Look`
FROM `items` WHERE `Id` = 973
ON DUPLICATE KEY UPDATE
  `Name` = VALUES(`Name`), `TypeId` = VALUES(`TypeId`), `Level` = VALUES(`Level`),
  `Usable` = VALUES(`Usable`), `Exchangeable` = VALUES(`Exchangeable`), `IsSaleable` = VALUES(`IsSaleable`);

INSERT INTO `items`
  (`Id`, `Name`, `TypeId`, `Level`, `RealWeight`, `Cursed`, `Usable`, `Exchangeable`,
   `Price`, `Etheral`, `ItemSetId`, `Criteria`, `AppearenceId`, `DropMonsterIds`,
   `RecipeSlots`, `RecipeIds`, `Effects`, `CraftXpRatio`, `IsSaleable`, `Look`)
SELECT 31003, 'Filet Pokéfus 41-60', 507, 41, 1, `Cursed`, 0, 1, 300, `Etheral`, -1, '', 0,
       `DropMonsterIds`, 0, `RecipeIds`, `Effects`, `CraftXpRatio`, 1, `Look`
FROM `items` WHERE `Id` = 973
ON DUPLICATE KEY UPDATE
  `Name` = VALUES(`Name`), `TypeId` = VALUES(`TypeId`), `Level` = VALUES(`Level`),
  `Usable` = VALUES(`Usable`), `Exchangeable` = VALUES(`Exchangeable`), `IsSaleable` = VALUES(`IsSaleable`);

INSERT INTO `items`
  (`Id`, `Name`, `TypeId`, `Level`, `RealWeight`, `Cursed`, `Usable`, `Exchangeable`,
   `Price`, `Etheral`, `ItemSetId`, `Criteria`, `AppearenceId`, `DropMonsterIds`,
   `RecipeSlots`, `RecipeIds`, `Effects`, `CraftXpRatio`, `IsSaleable`, `Look`)
SELECT 31004, 'Filet Pokéfus 61-80', 507, 61, 1, `Cursed`, 0, 1, 400, `Etheral`, -1, '', 0,
       `DropMonsterIds`, 0, `RecipeIds`, `Effects`, `CraftXpRatio`, 1, `Look`
FROM `items` WHERE `Id` = 973
ON DUPLICATE KEY UPDATE
  `Name` = VALUES(`Name`), `TypeId` = VALUES(`TypeId`), `Level` = VALUES(`Level`),
  `Usable` = VALUES(`Usable`), `Exchangeable` = VALUES(`Exchangeable`), `IsSaleable` = VALUES(`IsSaleable`);

INSERT INTO `items`
  (`Id`, `Name`, `TypeId`, `Level`, `RealWeight`, `Cursed`, `Usable`, `Exchangeable`,
   `Price`, `Etheral`, `ItemSetId`, `Criteria`, `AppearenceId`, `DropMonsterIds`,
   `RecipeSlots`, `RecipeIds`, `Effects`, `CraftXpRatio`, `IsSaleable`, `Look`)
SELECT 31005, 'Filet Pokéfus 81-100', 507, 81, 1, `Cursed`, 0, 1, 500, `Etheral`, -1, '', 0,
       `DropMonsterIds`, 0, `RecipeIds`, `Effects`, `CraftXpRatio`, 1, `Look`
FROM `items` WHERE `Id` = 973
ON DUPLICATE KEY UPDATE
  `Name` = VALUES(`Name`), `TypeId` = VALUES(`TypeId`), `Level` = VALUES(`Level`),
  `Usable` = VALUES(`Usable`), `Exchangeable` = VALUES(`Exchangeable`), `IsSaleable` = VALUES(`IsSaleable`);

INSERT INTO `items`
  (`Id`, `Name`, `TypeId`, `Level`, `RealWeight`, `Cursed`, `Usable`, `Exchangeable`,
   `Price`, `Etheral`, `ItemSetId`, `Criteria`, `AppearenceId`, `DropMonsterIds`,
   `RecipeSlots`, `RecipeIds`, `Effects`, `CraftXpRatio`, `IsSaleable`, `Look`)
SELECT 31006, 'Filet Pokéfus 101-120', 507, 101, 1, `Cursed`, 0, 1, 600, `Etheral`, -1, '', 0,
       `DropMonsterIds`, 0, `RecipeIds`, `Effects`, `CraftXpRatio`, 1, `Look`
FROM `items` WHERE `Id` = 973
ON DUPLICATE KEY UPDATE
  `Name` = VALUES(`Name`), `TypeId` = VALUES(`TypeId`), `Level` = VALUES(`Level`),
  `Usable` = VALUES(`Usable`), `Exchangeable` = VALUES(`Exchangeable`), `IsSaleable` = VALUES(`IsSaleable`);

INSERT INTO `items`
  (`Id`, `Name`, `TypeId`, `Level`, `RealWeight`, `Cursed`, `Usable`, `Exchangeable`,
   `Price`, `Etheral`, `ItemSetId`, `Criteria`, `AppearenceId`, `DropMonsterIds`,
   `RecipeSlots`, `RecipeIds`, `Effects`, `CraftXpRatio`, `IsSaleable`, `Look`)
SELECT 31007, 'Filet Pokéfus 121-140', 507, 121, 1, `Cursed`, 0, 1, 700, `Etheral`, -1, '', 0,
       `DropMonsterIds`, 0, `RecipeIds`, `Effects`, `CraftXpRatio`, 1, `Look`
FROM `items` WHERE `Id` = 973
ON DUPLICATE KEY UPDATE
  `Name` = VALUES(`Name`), `TypeId` = VALUES(`TypeId`), `Level` = VALUES(`Level`),
  `Usable` = VALUES(`Usable`), `Exchangeable` = VALUES(`Exchangeable`), `IsSaleable` = VALUES(`IsSaleable`);

INSERT INTO `items`
  (`Id`, `Name`, `TypeId`, `Level`, `RealWeight`, `Cursed`, `Usable`, `Exchangeable`,
   `Price`, `Etheral`, `ItemSetId`, `Criteria`, `AppearenceId`, `DropMonsterIds`,
   `RecipeSlots`, `RecipeIds`, `Effects`, `CraftXpRatio`, `IsSaleable`, `Look`)
SELECT 31008, 'Filet Pokéfus 141-160', 507, 141, 1, `Cursed`, 0, 1, 800, `Etheral`, -1, '', 0,
       `DropMonsterIds`, 0, `RecipeIds`, `Effects`, `CraftXpRatio`, 1, `Look`
FROM `items` WHERE `Id` = 973
ON DUPLICATE KEY UPDATE
  `Name` = VALUES(`Name`), `TypeId` = VALUES(`TypeId`), `Level` = VALUES(`Level`),
  `Usable` = VALUES(`Usable`), `Exchangeable` = VALUES(`Exchangeable`), `IsSaleable` = VALUES(`IsSaleable`);

INSERT INTO `items`
  (`Id`, `Name`, `TypeId`, `Level`, `RealWeight`, `Cursed`, `Usable`, `Exchangeable`,
   `Price`, `Etheral`, `ItemSetId`, `Criteria`, `AppearenceId`, `DropMonsterIds`,
   `RecipeSlots`, `RecipeIds`, `Effects`, `CraftXpRatio`, `IsSaleable`, `Look`)
SELECT 31009, 'Filet Pokéfus 161-180', 507, 161, 1, `Cursed`, 0, 1, 900, `Etheral`, -1, '', 0,
       `DropMonsterIds`, 0, `RecipeIds`, `Effects`, `CraftXpRatio`, 1, `Look`
FROM `items` WHERE `Id` = 973
ON DUPLICATE KEY UPDATE
  `Name` = VALUES(`Name`), `TypeId` = VALUES(`TypeId`), `Level` = VALUES(`Level`),
  `Usable` = VALUES(`Usable`), `Exchangeable` = VALUES(`Exchangeable`), `IsSaleable` = VALUES(`IsSaleable`);

INSERT INTO `items`
  (`Id`, `Name`, `TypeId`, `Level`, `RealWeight`, `Cursed`, `Usable`, `Exchangeable`,
   `Price`, `Etheral`, `ItemSetId`, `Criteria`, `AppearenceId`, `DropMonsterIds`,
   `RecipeSlots`, `RecipeIds`, `Effects`, `CraftXpRatio`, `IsSaleable`, `Look`)
SELECT 31010, 'Filet Pokéfus 181-200', 507, 181, 1, `Cursed`, 0, 1, 1000, `Etheral`, -1, '', 0,
       `DropMonsterIds`, 0, `RecipeIds`, `Effects`, `CraftXpRatio`, 1, `Look`
FROM `items` WHERE `Id` = 973
ON DUPLICATE KEY UPDATE
  `Name` = VALUES(`Name`), `TypeId` = VALUES(`TypeId`), `Level` = VALUES(`Level`),
  `Usable` = VALUES(`Usable`), `Exchangeable` = VALUES(`Exchangeable`), `IsSaleable` = VALUES(`IsSaleable`);

DELETE FROM `items` WHERE `Id` BETWEEN 30001 AND 30010;

INSERT INTO `pokefus_capture_nets`
  (`Id`, `ItemGid`, `MinMonsterLevel`, `MaxMonsterLevel`, `Enabled`)
VALUES
  (1, 31001, 1, 20, 1),
  (2, 31002, 21, 40, 1),
  (3, 31003, 41, 60, 1),
  (4, 31004, 61, 80, 1),
  (5, 31005, 81, 100, 1),
  (6, 31006, 101, 120, 1),
  (7, 31007, 121, 140, 1),
  (8, 31008, 141, 160, 1),
  (9, 31009, 161, 180, 1),
  (10, 31010, 181, 200, 1)
ON DUPLICATE KEY UPDATE
  `ItemGid` = VALUES(`ItemGid`),
  `MinMonsterLevel` = VALUES(`MinMonsterLevel`),
  `MaxMonsterLevel` = VALUES(`MaxMonsterLevel`),
  `Enabled` = VALUES(`Enabled`);

UPDATE `character_items`
SET `GId` = `GId` + 1000
WHERE `GId` BETWEEN 30001 AND 30010;
