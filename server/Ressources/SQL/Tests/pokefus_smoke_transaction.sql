START TRANSACTION;

DELETE FROM pokefus_equipped_genes WHERE PokefusId IN (SELECT Id FROM pokefus WHERE CharacterId = -99001);
DELETE FROM pokefus_unlocked_genes WHERE PokefusId IN (SELECT Id FROM pokefus WHERE CharacterId = -99001);
DELETE FROM player_pokefus_researched_genes WHERE CharacterId = -99001;
DELETE FROM player_pokefus_species_progress WHERE CharacterId = -99001;
DELETE FROM pokefus WHERE CharacterId = -99001;

INSERT INTO pokefus
  (CharacterId, SpeciesId, CharacterItemUid, CustomName, Level, IndividualExperience, CapturedAt, IsActive)
VALUES
  (-99001, 101, -99001, 'Smoke Bouftou', 1, 0, UTC_TIMESTAMP(), 1);
SET @pokefus_id = LAST_INSERT_ID();

-- A 1,500 XP fight with three active Pokéfus credits 500 to this species.
INSERT INTO player_pokefus_species_progress
  (CharacterId, SpeciesId, TotalExperience, AvailableExperience, UpdatedAt)
VALUES
  (-99001, 101, 500, 500, UTC_TIMESTAMP());

UPDATE player_pokefus_species_progress
SET AvailableExperience = AvailableExperience - 500
WHERE CharacterId = -99001 AND SpeciesId = 101 AND AvailableExperience >= 500;

INSERT INTO player_pokefus_researched_genes
  (CharacterId, SpeciesId, GeneId, ResearchedAt)
VALUES
  (-99001, 101, 101001, UTC_TIMESTAMP());

INSERT INTO pokefus_unlocked_genes
  (PokefusId, GeneId, PaymentMethod, PaidKamas, PaidOgrines, UnlockedAt)
VALUES
  (@pokefus_id, 101001, 'KAMAS', 5000, 0, UTC_TIMESTAMP());

INSERT INTO pokefus_equipped_genes
  (PokefusId, GeneId, Slot, EquippedAt)
VALUES
  (@pokefus_id, 101001, 0, UTC_TIMESTAMP());

SELECT
  (SELECT TotalExperience FROM player_pokefus_species_progress WHERE CharacterId = -99001 AND SpeciesId = 101) AS TotalXp,
  (SELECT AvailableExperience FROM player_pokefus_species_progress WHERE CharacterId = -99001 AND SpeciesId = 101) AS AvailableXp,
  (SELECT COUNT(*) FROM player_pokefus_researched_genes WHERE CharacterId = -99001 AND GeneId = 101001) AS Researched,
  (SELECT COUNT(*) FROM pokefus_unlocked_genes WHERE PokefusId = @pokefus_id AND GeneId = 101001 AND PaymentMethod = 'KAMAS' AND PaidOgrines = 0) AS UnlockedKamas,
  (SELECT COUNT(*) FROM pokefus_equipped_genes WHERE PokefusId = @pokefus_id AND GeneId = 101001 AND Slot = 0) AS Equipped;

ROLLBACK;

SELECT
  (SELECT COUNT(*) FROM pokefus WHERE CharacterId = -99001) AS RemainingPokefus,
  (SELECT COUNT(*) FROM player_pokefus_species_progress WHERE CharacterId = -99001) AS RemainingProgress;
