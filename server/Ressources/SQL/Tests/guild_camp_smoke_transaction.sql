-- Parcours vertical MVP du Campement de guilde.
-- Toutes les écritures sont annulées à la fin du test.

START TRANSACTION;

DELETE FROM guild_project_contributions
WHERE ProjectId IN (SELECT Id FROM guild_projects WHERE GuildId = -99002);
DELETE FROM guild_project_requirements
WHERE ProjectId IN (SELECT Id FROM guild_projects WHERE GuildId = -99002);
DELETE FROM guild_projects WHERE GuildId = -99002;
DELETE FROM guild_building_states WHERE GuildId = -99002;

INSERT INTO guild_building_states (GuildId, BuildingId, Level, UpdatedAt)
SELECT -99002, Id, 1, UTC_TIMESTAMP()
FROM guild_buildings
WHERE Enabled = 1;

-- Simulation d'un projet Forge niveau 2 entièrement financé.
INSERT INTO guild_projects
  (GuildId, BuildingId, TargetLevel, Status, KamasContributed, CreatedAt)
VALUES
  (-99002, 2, 2, 'ACTIVE', 100000, UTC_TIMESTAMP());
SET @forge_project_id = LAST_INSERT_ID();

INSERT INTO guild_project_requirements
  (ProjectId, ItemId, RequiredQuantity, ContributedQuantity)
SELECT @forge_project_id, ItemId, RequiredQuantity, RequiredQuantity
FROM guild_building_level_requirements
WHERE BuildingLevelId = 202;

INSERT INTO guild_project_contributions
  (ProjectId, CharacterId, ContributionType, ItemId, Quantity, CreatedAt)
VALUES
  (@forge_project_id, -99002, 'KAMAS', NULL, 100000, UTC_TIMESTAMP()),
  (@forge_project_id, -99002, 'RESOURCE', 312, 10, UTC_TIMESTAMP());

-- Même garde que le service : niveau courant, coût et ressources doivent tous être prêts.
UPDATE guild_building_states state
JOIN guild_projects project
  ON project.GuildId = state.GuildId
 AND project.BuildingId = state.BuildingId
 AND project.TargetLevel = 2
SET state.Level = 2,
    state.UpdatedAt = UTC_TIMESTAMP(),
    project.Status = 'COMPLETED',
    project.CompletedAt = UTC_TIMESTAMP(),
    project.CompletedByCharacterId = -99002
WHERE state.GuildId = -99002
  AND state.BuildingId = 2
  AND state.Level = 1
  AND project.Status = 'ACTIVE'
  AND project.KamasContributed >= (
    SELECT KamaCost FROM guild_building_levels WHERE Id = 202
  )
  AND NOT EXISTS (
    SELECT 1
    FROM guild_project_requirements requirement
    WHERE requirement.ProjectId = project.Id
      AND requirement.ContributedQuantity < requirement.RequiredQuantity
  );

SELECT
  state.Level AS ForgeLevel,
  level.AssetPath AS ForgeAsset,
  effect.EffectType,
  effect.Value AS EffectPercent,
  CEILING(20 * (1 + effect.Value / 100)) AS ResourceCostFor20
FROM guild_building_states state
JOIN guild_building_levels level
  ON level.BuildingId = state.BuildingId AND level.Level = state.Level
JOIN guild_building_effects effect
  ON effect.BuildingLevelId = level.Id
WHERE state.GuildId = -99002
  AND state.BuildingId = 2
  AND effect.EffectType = 'CRAFT_COST_PERCENT';

ROLLBACK;

SELECT
  (SELECT COUNT(*) FROM guild_building_states WHERE GuildId = -99002) AS RemainingStates,
  (SELECT COUNT(*) FROM guild_projects WHERE GuildId = -99002) AS RemainingProjects;
