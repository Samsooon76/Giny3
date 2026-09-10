using Giny.Core;
using Giny.Core.DesignPattern;
using Giny.ORM;
using Giny.Pokefus.Data.Records;
using Giny.Pokefus.Effects;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Api;
using Giny.World.Managers.Items;
using Giny.World.Records.Items;
using MySql.Data.MySqlClient;
using System.Collections.Concurrent;
using System.Text.Json;

namespace Giny.Pokefus
{
    /// <summary>
    /// Authoritative persistence and state-transition boundary for the Pokéfus genome.
    /// Every multi-row mutation is committed in a single database transaction.
    /// </summary>
    public sealed class PokefusGenomeService : Singleton<PokefusGenomeService>
    {
        public const string StatePrefix = "[POKEFUS_STATE]";

        // Slots are flattened by branch: branch 1 starts at 0, branch 2 after
        // branch 1, and branch 3 after branch 2. This keeps the existing
        // pokefus_equipped_genes schema while exposing the intended 4/2/0 and
        // 4/4/2 builds.
        public static (byte BranchOne, byte BranchTwo, byte BranchThree) GetGeneBuild(bool legendary)
        {
            return legendary ? ((byte)4, (byte)4, (byte)2) : ((byte)4, (byte)2, (byte)0);
        }

        public static int GetBranchLimit(bool legendary, short displayOrder)
        {
            var build = GetGeneBuild(legendary);
            return displayOrder switch
            {
                1 => build.BranchOne,
                2 => build.BranchTwo,
                3 => build.BranchThree,
                _ => 0,
            };
        }

        public static int GetBranchSlotStart(bool legendary, short displayOrder)
        {
            var build = GetGeneBuild(legendary);
            return displayOrder switch
            {
                1 => 0,
                2 => build.BranchOne,
                3 => build.BranchOne + build.BranchTwo,
                _ => -1,
            };
        }

        public static int GetTotalGeneSlots(bool legendary)
        {
            var build = GetGeneBuild(legendary);
            return build.BranchOne + build.BranchTwo + build.BranchThree;
        }

        private readonly ConcurrentDictionary<long, object> characterLocks = new();

        public void EnsureCharacterState(Character character)
        {
            CharacterItemRecord[] items = character.Inventory.GetItems()
                .Where(PokefusManager.Instance.IsPokefusItem)
                .ToArray();

            // Legacy wish items predate the species table. Preserve every captured
            // individual by creating a disabled-capture placeholder species. An
            // administrator can later configure its branches/genes in SQL.
            EffectPokefus[] missingSpecies = items
                .Select(item => item.Effects.GetFirst<EffectPokefus>())
                .Where(effect => effect != null && PokefusSpeciesRecord.GetSpeciesByMonster(effect.MonsterId) == null)
                .Cast<EffectPokefus>()
                .GroupBy(effect => effect.MonsterId)
                .Select(group => group.First())
                .ToArray();

            if (missingSpecies.Length > 0)
            {
                bool inserted = DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
                {
                    int affected = 0;
                    foreach (EffectPokefus effect in missingSpecies)
                    {
                        using MySqlCommand command = Command(connection, transaction,
                            "INSERT IGNORE INTO pokefus_species " +
                            "(Id,MonsterId,Name,CaptureEnabled,CaptureRate,MaximumHealthPercent,RequiredItemId,MaxActiveGenes,Enabled) " +
                            "VALUES (@id,@monster,@name,0,0,100,NULL,4,1)",
                            ("@id", 1_000_000L + effect.MonsterId),
                            ("@monster", effect.MonsterId),
                            ("@name", effect.MonsterName));
                        affected += command.ExecuteNonQuery();
                    }
                    return affected > 0;
                });

                if (inserted)
                {
                    DatabaseManager.Instance.Reload<PokefusSpeciesRecord>();
                    Logger.Write(
                        $"[Pokéfus][MIGRATION] character={character.Id} legacySpecies={missingSpecies.Length}",
                        Channels.Info);
                }
            }

            foreach (CharacterItemRecord item in items)
            {
                EnsureInstance(character, item);
            }
        }

        public long EnsureInstance(Character character, CharacterItemRecord item, bool? legendary = null)
        {
            EffectPokefus? effect = item.Effects.GetFirst<EffectPokefus>();
            EffectPokefusLevel? level = item.Effects.GetFirst<EffectPokefusLevel>();
            PokefusSpeciesRecord? species = effect == null ? null : PokefusSpeciesRecord.GetSpeciesByMonster(effect.MonsterId);

            if (effect == null || level == null || species == null || !species.Enabled)
            {
                return 0;
            }

            bool active = item.IsEquiped() && PokefusManager.IsPokefusPosition(item.PositionEnum);
            return DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                using (MySqlCommand insert = Command(connection, transaction,
                    "INSERT IGNORE INTO pokefus " +
                    "(CharacterId,SpeciesId,CharacterItemUid,CustomName,Level,IndividualExperience,CapturedAt,IsActive,IsLegendary) " +
                    "VALUES (@character,@species,@uid,NULL,@level,@experience,UTC_TIMESTAMP(),@active,@legendary)",
                    ("@character", character.Id), ("@species", species.Id), ("@uid", item.UId),
                    ("@level", level.Level), ("@experience", level.Exp), ("@active", active),
                    ("@legendary", legendary ?? false)))
                {
                    insert.ExecuteNonQuery();
                }

                using (MySqlCommand update = Command(connection, transaction,
                    "UPDATE pokefus SET CharacterId=@character,SpeciesId=@species,Level=@level," +
                    "IndividualExperience=@experience,IsActive=@active" +
                    (legendary.HasValue ? ",IsLegendary=@legendary" : string.Empty) +
                    " WHERE CharacterItemUid=@uid",
                    ("@character", character.Id), ("@species", species.Id), ("@uid", item.UId),
                    ("@level", level.Level), ("@experience", level.Exp), ("@active", active),
                    ("@legendary", legendary ?? false)))
                {
                    update.ExecuteNonQuery();
                }

                using MySqlCommand select = Command(connection, transaction,
                    "SELECT Id FROM pokefus WHERE CharacterId=@character AND CharacterItemUid=@uid LIMIT 1",
                    ("@character", character.Id), ("@uid", item.UId));
                return Convert.ToInt64(select.ExecuteScalar() ?? 0L);
            });
        }

        public void SyncItem(Character character, CharacterItemRecord item)
        {
            if (PokefusManager.Instance.IsPokefusItem(item))
            {
                EnsureInstance(character, item);
            }
        }

        /// <summary>Credits species-shared XP. The caller already supplies the per-active split.</summary>
        public void AddGeneticExperience(Character character, IReadOnlyCollection<CharacterItemRecord> activeItems, long fightExperience)
        {
            if (fightExperience <= 0 || activeItems.Count == 0)
            {
                return;
            }

            long perPokefus = fightExperience / activeItems.Count;
            if (perPokefus <= 0)
            {
                return;
            }

            var speciesShares = activeItems
                .Select(item => item.Effects.GetFirst<EffectPokefus>())
                .Where(effect => effect != null)
                .Select(effect => PokefusSpeciesRecord.GetSpeciesByMonster(effect!.MonsterId))
                .Where(species => species != null && species.Enabled)
                .GroupBy(species => species!.Id)
                .ToDictionary(group => group.Key, group => perPokefus * group.LongCount());

            if (speciesShares.Count == 0)
            {
                return;
            }

            DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                foreach ((long speciesId, long amount) in speciesShares)
                {
                    using MySqlCommand command = Command(connection, transaction,
                        "INSERT INTO player_pokefus_species_progress " +
                        "(CharacterId,SpeciesId,TotalExperience,AvailableExperience,UpdatedAt) " +
                        "VALUES (@character,@species,@amount,@amount,UTC_TIMESTAMP()) " +
                        "ON DUPLICATE KEY UPDATE TotalExperience=TotalExperience+@amount," +
                        "AvailableExperience=AvailableExperience+@amount,UpdatedAt=UTC_TIMESTAMP()",
                        ("@character", character.Id), ("@species", speciesId), ("@amount", amount));
                    command.ExecuteNonQuery();
                }

                return true;
            });

            Logger.Write(
                $"[Pokéfus][XP] character={character.Id} fightXp={fightExperience} active={activeItems.Count} split={perPokefus} species={string.Join(',', speciesShares.Select(x => $"{x.Key}:{x.Value}"))}",
                Channels.Info);
        }

        public OperationResult ResearchGene(Character character, long geneId)
        {
            PokefusGeneRecord? gene = PokefusGeneRecord.GetGene(geneId);
            if (gene == null || !gene.Enabled)
            {
                return OperationResult.Fail("Gène introuvable ou désactivé.");
            }

            OperationResult result = DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                if (!Exists(connection, transaction,
                    "SELECT 1 FROM pokefus WHERE CharacterId=@character AND SpeciesId=@species LIMIT 1",
                    ("@character", character.Id), ("@species", gene.SpeciesId)))
                {
                    return OperationResult.Fail("Tu ne possèdes aucun Pokéfus de cette espèce.");
                }

                if (Exists(connection, transaction,
                    "SELECT 1 FROM player_pokefus_researched_genes WHERE CharacterId=@character AND GeneId=@gene LIMIT 1",
                    ("@character", character.Id), ("@gene", gene.Id)))
                {
                    return OperationResult.Ok("Gène déjà recherché.");
                }

                if (gene.PrerequisiteGeneId.HasValue && !Exists(connection, transaction,
                    "SELECT 1 FROM player_pokefus_researched_genes WHERE CharacterId=@character AND GeneId=@gene LIMIT 1",
                    ("@character", character.Id), ("@gene", gene.PrerequisiteGeneId.Value)))
                {
                    return OperationResult.Fail("Le gène prérequis n'est pas encore recherché.");
                }

                long available = ScalarLong(connection, transaction,
                    "SELECT AvailableExperience FROM player_pokefus_species_progress " +
                    "WHERE CharacterId=@character AND SpeciesId=@species FOR UPDATE",
                    ("@character", character.Id), ("@species", gene.SpeciesId));
                if (available < gene.XpCost)
                {
                    return OperationResult.Fail($"XP génétique insuffisante ({available}/{gene.XpCost}).");
                }

                using (MySqlCommand spend = Command(connection, transaction,
                    "UPDATE player_pokefus_species_progress SET AvailableExperience=AvailableExperience-@cost," +
                    "UpdatedAt=UTC_TIMESTAMP() WHERE CharacterId=@character AND SpeciesId=@species",
                    ("@cost", gene.XpCost), ("@character", character.Id), ("@species", gene.SpeciesId)))
                {
                    spend.ExecuteNonQuery();
                }

                using MySqlCommand insert = Command(connection, transaction,
                    "INSERT INTO player_pokefus_researched_genes (CharacterId,SpeciesId,GeneId,ResearchedAt) " +
                    "VALUES (@character,@species,@gene,UTC_TIMESTAMP())",
                    ("@character", character.Id), ("@species", gene.SpeciesId), ("@gene", gene.Id));
                insert.ExecuteNonQuery();
                return OperationResult.Ok($"Recherche terminée : {gene.Name} (-{gene.XpCost} XP génétique).");
            });

            LogOperation(character, "RESEARCH", geneId, result);
            return result;
        }

        public OperationResult UnlockGene(Character character, long pokefusId, long geneId)
        {
            PokefusGeneRecord? gene = PokefusGeneRecord.GetGene(geneId);
            if (gene == null || !gene.Enabled)
            {
                return OperationResult.Fail("Gène introuvable ou désactivé.");
            }

            lock (characterLocks.GetOrAdd(character.Id, _ => new object()))
            lock (character.KamasSyncRoot)
            {
                long newKamas = character.Record.Kamas;
                long activationCost = GuildBuildingEffectApi.ApplyCost(
                    character,
                    "POKEFUS_ACTIVATION_COST_PERCENT",
                    gene.KamaCost);
                OperationResult result = DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
                {
                    if (!Exists(connection, transaction,
                        "SELECT 1 FROM pokefus WHERE Id=@pokefus AND CharacterId=@character AND SpeciesId=@species LIMIT 1 FOR UPDATE",
                        ("@pokefus", pokefusId), ("@character", character.Id), ("@species", gene.SpeciesId)))
                    {
                        return OperationResult.Fail("Ce Pokéfus ne t'appartient pas ou n'est pas de la bonne espèce.");
                    }

                    if (!Exists(connection, transaction,
                        "SELECT 1 FROM player_pokefus_researched_genes WHERE CharacterId=@character AND GeneId=@gene LIMIT 1",
                        ("@character", character.Id), ("@gene", gene.Id)))
                    {
                        return OperationResult.Fail("Ce gène doit d'abord être recherché.");
                    }

                    if (Exists(connection, transaction,
                        "SELECT 1 FROM pokefus_unlocked_genes WHERE PokefusId=@pokefus AND GeneId=@gene LIMIT 1",
                        ("@pokefus", pokefusId), ("@gene", gene.Id)))
                    {
                        return OperationResult.Ok("Gène déjà activé sur ce Pokéfus.");
                    }

                    if (character.Record.Kamas < activationCost)
                    {
                        return OperationResult.Fail($"Kamas insuffisants ({character.Record.Kamas}/{activationCost}).");
                    }

                    newKamas = character.Record.Kamas - activationCost;
                    using (MySqlCommand debit = Command(connection, transaction,
                        "UPDATE characters SET Kamas=@kamas WHERE Id=@character",
                        ("@kamas", newKamas), ("@character", character.Id)))
                    {
                        if (debit.ExecuteNonQuery() != 1)
                        {
                            throw new InvalidOperationException("Unable to persist Pokéfus kama debit.");
                        }
                    }

                    using MySqlCommand insert = Command(connection, transaction,
                        "INSERT INTO pokefus_unlocked_genes " +
                        "(PokefusId,GeneId,PaymentMethod,PaidKamas,PaidOgrines,UnlockedAt) " +
                        "VALUES (@pokefus,@gene,'KAMAS',@cost,0,UTC_TIMESTAMP())",
                        ("@pokefus", pokefusId), ("@gene", gene.Id), ("@cost", activationCost));
                    insert.ExecuteNonQuery();
                    return OperationResult.Ok($"Gène activé : {gene.Name} (-{activationCost} kamas).");
                });

                if (result.Success && newKamas != character.Record.Kamas)
                {
                    character.Record.Kamas = newKamas;
                    character.Inventory.RefreshKamas();
                }

                LogOperation(character, "UNLOCK_KAMAS", geneId, result, pokefusId);
                return result;
            }
        }

        public OperationResult EquipGene(Character character, long pokefusId, long geneId, byte slot)
        {
            PokefusGeneRecord? gene = PokefusGeneRecord.GetGene(geneId);
            if (gene == null || !gene.Enabled)
            {
                return OperationResult.Fail("Gène introuvable ou désactivé.");
            }

            PokefusSpeciesRecord? species = PokefusSpeciesRecord.GetSpecies(gene.SpeciesId);
            PokefusRecord? instance = PokefusRecord.Get(pokefusId);
            if (species == null || instance == null || instance.CharacterId != character.Id || instance.SpeciesId != gene.SpeciesId)
            {
                return OperationResult.Fail("Ce Pokéfus ne t'appartient pas.");
            }

            PokefusGenomeBranchRecord? branch = PokefusGenomeBranchRecord.GetBranch(gene.BranchId);
            int branchLimit = branch == null ? 0 : GetBranchLimit(instance.IsLegendary, branch.DisplayOrder);
            int branchStart = branch == null ? -1 : GetBranchSlotStart(instance.IsLegendary, branch.DisplayOrder);
            if (branchLimit <= 0 || branchStart < 0 || slot < branchStart || slot >= branchStart + branchLimit)
            {
                return OperationResult.Fail($"Ce build autorise {branchLimit} slot(s) dans cette branche.");
            }

            int branchGeneCount = PokefusEquippedGeneRecord.GetByPokefus(pokefusId)
                .Where(x => x.Slot >= branchStart && x.Slot < branchStart + branchLimit && x.GeneId != gene.Id)
                .Count();
            if (branchGeneCount >= branchLimit && !PokefusEquippedGeneRecord.GetByPokefus(pokefusId).Any(x => x.Slot == slot))
            {
                return OperationResult.Fail("Tous les slots de cette branche sont déjà occupés.");
            }

            OperationResult result = DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                if (!Exists(connection, transaction,
                    "SELECT 1 FROM pokefus WHERE Id=@pokefus AND CharacterId=@character AND SpeciesId=@species LIMIT 1",
                    ("@pokefus", pokefusId), ("@character", character.Id), ("@species", gene.SpeciesId)))
                {
                    return OperationResult.Fail("Ce Pokéfus ne t'appartient pas.");
                }

                if (!Exists(connection, transaction,
                    "SELECT 1 FROM pokefus_unlocked_genes WHERE PokefusId=@pokefus AND GeneId=@gene LIMIT 1",
                    ("@pokefus", pokefusId), ("@gene", gene.Id)))
                {
                    return OperationResult.Fail("Ce gène n'est pas activé sur ce Pokéfus.");
                }

                using (MySqlCommand clearGene = Command(connection, transaction,
                    "DELETE FROM pokefus_equipped_genes WHERE PokefusId=@pokefus AND GeneId=@gene",
                    ("@pokefus", pokefusId), ("@gene", gene.Id)))
                {
                    clearGene.ExecuteNonQuery();
                }
                using (MySqlCommand clearSlot = Command(connection, transaction,
                    "DELETE FROM pokefus_equipped_genes WHERE PokefusId=@pokefus AND Slot=@slot",
                    ("@pokefus", pokefusId), ("@slot", slot)))
                {
                    clearSlot.ExecuteNonQuery();
                }
                using MySqlCommand insert = Command(connection, transaction,
                    "INSERT INTO pokefus_equipped_genes (PokefusId,GeneId,Slot,EquippedAt) " +
                    "VALUES (@pokefus,@gene,@slot,UTC_TIMESTAMP())",
                    ("@pokefus", pokefusId), ("@gene", gene.Id), ("@slot", slot));
                insert.ExecuteNonQuery();
                return OperationResult.Ok($"{gene.Name} équipé dans le slot {slot + 1}.");
            });

            LogOperation(character, "EQUIP", geneId, result, pokefusId, slot);
            return result;
        }

        public OperationResult UnequipGene(Character character, long pokefusId, byte slot)
        {
            int affected = DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                if (!Exists(connection, transaction,
                    "SELECT 1 FROM pokefus WHERE Id=@pokefus AND CharacterId=@character LIMIT 1",
                    ("@pokefus", pokefusId), ("@character", character.Id)))
                {
                    return -1;
                }

                using MySqlCommand command = Command(connection, transaction,
                    "DELETE FROM pokefus_equipped_genes WHERE PokefusId=@pokefus AND Slot=@slot",
                    ("@pokefus", pokefusId), ("@slot", slot));
                return command.ExecuteNonQuery();
            });

            OperationResult result = affected < 0
                ? OperationResult.Fail("Ce Pokéfus ne t'appartient pas.")
                : OperationResult.Ok(affected == 0 ? "Ce slot est déjà vide." : $"Slot {slot + 1} libéré.");
            LogOperation(character, "UNEQUIP", 0, result, pokefusId, slot);
            return result;
        }

        public IReadOnlyList<PokefusGeneRecord> GetEquippedGenes(int characterItemUid)
        {
            long pokefusId = DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
                ScalarLong(connection, transaction,
                    "SELECT Id FROM pokefus WHERE CharacterItemUid=@uid LIMIT 1", ("@uid", characterItemUid)));
            if (pokefusId == 0)
            {
                return Array.Empty<PokefusGeneRecord>();
            }

            return PokefusEquippedGeneRecord.GetByPokefus(pokefusId)
                .Select(x => PokefusGeneRecord.GetGene(x.GeneId))
                .Where(x => x != null && x.Enabled)
                .Cast<PokefusGeneRecord>()
                .ToArray();
        }

        public void SendState(Character character, OperationResult? operation = null)
        {
            EnsureCharacterState(character);
            string json = BuildStateJson(character, operation);
            character.Reply(StatePrefix + Uri.EscapeDataString(json));
        }

        private string BuildStateJson(Character character, OperationResult? operation)
        {
            PokefusRecord[] instances = PokefusRecord.GetByCharacter(character.Id).ToArray();
            long[] instanceIds = instances.Select(x => x.Id).ToArray();
            long[] speciesIds = instances.Select(x => x.SpeciesId).Distinct().ToArray();
            var progress = speciesIds.ToDictionary(
                id => id,
                id => PlayerPokefusSpeciesProgressRecord.Get(character.Id, id));
            var researched = speciesIds.ToDictionary(
                id => id,
                id => PlayerPokefusResearchedGeneRecord.GetByCharacterAndSpecies(character.Id, id)
                    .Select(x => x.GeneId).ToHashSet());
            var unlocked = instanceIds.ToDictionary(
                id => id,
                id => PokefusUnlockedGeneRecord.GetByPokefus(id).Select(x => x.GeneId).ToHashSet());
            var equipped = instanceIds.ToDictionary(
                id => id,
                id => PokefusEquippedGeneRecord.GetByPokefus(id).ToDictionary(x => x.Slot, x => x.GeneId));

            var payload = new
            {
                version = 1,
                maxActivePokefus = PokefusManager.MaxActivePokefus,
                maxActiveGenes = 6,
                geneBuild = new
                {
                    normal = new { branchOne = 4, branchTwo = 2, branchThree = 0 },
                    legendary = new { branchOne = 4, branchTwo = 4, branchThree = 2 },
                },
                kamas = character.Record.Kamas,
                operation = operation == null ? null : new { success = operation.Success, message = operation.Message },
                species = speciesIds.Select(speciesId =>
                {
                    PokefusSpeciesRecord species = PokefusSpeciesRecord.GetSpecies(speciesId)!;
                    PlayerPokefusSpeciesProgressRecord? xp = progress[speciesId];
                    return new
                    {
                        id = species.Id,
                        monsterId = species.MonsterId,
                        name = species.Name,
                        totalXp = xp?.TotalExperience ?? 0,
                        availableXp = xp?.AvailableExperience ?? 0,
                        branches = PokefusGenomeBranchRecord.GetBranches(speciesId).Where(x => x.Enabled).Select(branch => new
                        {
                            id = branch.Id,
                            name = branch.Name,
                            order = branch.DisplayOrder,
                            genes = PokefusGeneRecord.GetGenes(speciesId).Where(gene => gene.Enabled && gene.BranchId == branch.Id).Select(gene => new
                            {
                                id = gene.Id,
                                name = gene.Name,
                                description = gene.Description,
                                tier = gene.Tier,
                                xpCost = gene.XpCost,
                                kamaCost = gene.KamaCost,
                                ogrineCost = gene.OgrineCost,
                                prerequisiteGeneId = gene.PrerequisiteGeneId,
                                effectType = gene.EffectType,
                                researched = researched[speciesId].Contains(gene.Id)
                            })
                        })
                    };
                }),
                pokefus = instances.Select(instance =>
                {
                    CharacterItemRecord? item = instance.CharacterItemUid.HasValue
                        ? character.Inventory.GetItem(instance.CharacterItemUid.Value)
                        : null;
                    EffectPokefus? effect = item?.Effects.GetFirst<EffectPokefus>();

                    return new
                    {
                        id = instance.Id,
                        speciesId = instance.SpeciesId,
                        itemUid = instance.CharacterItemUid,
                        name = instance.CustomName ?? PokefusSpeciesRecord.GetSpecies(instance.SpeciesId)?.Name ?? "Pokéfus",
                        level = instance.Level,
                        experience = instance.IndividualExperience,
                        legendary = instance.IsLegendary,
                        gradeId = effect?.GradeId ?? 1,
                        active = instance.IsActive,
                        unlockedGeneIds = unlocked[instance.Id],
                        equippedGenes = equipped[instance.Id].Select(x => new { slot = x.Key, geneId = x.Value })
                    };
                })
            };

            return JsonSerializer.Serialize(payload);
        }

        private static MySqlCommand Command(
            MySqlConnection connection,
            MySqlTransaction transaction,
            string sql,
            params (string Name, object? Value)[] parameters)
        {
            MySqlCommand command = new(sql, connection, transaction);
            foreach ((string name, object? value) in parameters)
            {
                command.Parameters.AddWithValue(name, value ?? DBNull.Value);
            }
            return command;
        }

        private static bool Exists(
            MySqlConnection connection,
            MySqlTransaction transaction,
            string sql,
            params (string Name, object? Value)[] parameters)
        {
            using MySqlCommand command = Command(connection, transaction, sql, parameters);
            return command.ExecuteScalar() != null;
        }

        private static long ScalarLong(
            MySqlConnection connection,
            MySqlTransaction transaction,
            string sql,
            params (string Name, object? Value)[] parameters)
        {
            using MySqlCommand command = Command(connection, transaction, sql, parameters);
            object? value = command.ExecuteScalar();
            return value == null || value == DBNull.Value ? 0 : Convert.ToInt64(value);
        }

        private static void LogOperation(
            Character character,
            string action,
            long geneId,
            OperationResult result,
            long pokefusId = 0,
            byte slot = 0)
        {
            Logger.Write(
                $"[Pokéfus][{action}] character={character.Id} pokefus={pokefusId} gene={geneId} slot={slot} success={result.Success} message={result.Message}",
                result.Success ? Channels.Info : Channels.Warning);
        }
    }

    public sealed record OperationResult(bool Success, string Message)
    {
        public static OperationResult Ok(string message) => new(true, message);
        public static OperationResult Fail(string message) => new(false, message);
    }
}
