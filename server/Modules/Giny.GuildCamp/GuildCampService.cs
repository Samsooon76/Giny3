using Giny.Core;
using Giny.Core.DesignPattern;
using Giny.GuildCamp.Data.Records;
using Giny.ORM;
using Giny.Protocol.Enums;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Records.Items;
using MySql.Data.MySqlClient;
using System.Collections.Concurrent;
using System.Text.Json;

namespace Giny.GuildCamp
{
    public sealed class GuildCampService : Singleton<GuildCampService>
    {
        public const string StatePrefix = "[GUILD_CAMP_STATE]";

        private readonly ConcurrentDictionary<long, object> guildLocks = new();
        private readonly ConcurrentDictionary<(long GuildId, string EffectType), double> effectCache = new();

        public void SendState(Character character, CampOperationResult? operation = null)
        {
            if (!character.HasGuild || character.Guild == null)
            {
                character.ReplyWarning("Vous devez appartenir à une guilde pour ouvrir le campement.");
                return;
            }

            string json = BuildStateJson(character, operation);
            character.Reply(StatePrefix + Uri.EscapeDataString(json));
        }

        public CampOperationResult ContributeKamas(Character character, long buildingId, long amount)
        {
            CampOperationResult? invalid = ValidateMemberAndAmount(character, amount);
            if (invalid != null)
            {
                return invalid;
            }

            GuildBuildingRecord? building = GuildBuildingRecord.Get(buildingId);
            if (building == null || !building.Enabled)
            {
                return CampOperationResult.Fail("Bâtiment introuvable.");
            }

            lock (guildLocks.GetOrAdd(character.Guild.Id, _ => new object()))
            lock (character.KamasSyncRoot)
            {
                EnsureGuildState(character.Guild.Id);
                byte level = GetCurrentLevel(character.Guild.Id, buildingId);
                GuildBuildingLevelRecord? target = GuildBuildingLevelRecord.Get(buildingId, (byte)(level + 1));
                if (target == null)
                {
                    return CampOperationResult.Fail("Ce bâtiment est déjà au niveau maximum.");
                }

                long projectId = EnsureActiveProject(character.Guild.Id, buildingId, target);
                long newKamas = 0;
                CampOperationResult result = DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
                {
                    long contributed = ScalarLong(connection, transaction,
                        "SELECT KamasContributed FROM guild_projects WHERE Id=@project AND Status='ACTIVE' FOR UPDATE",
                        ("@project", projectId));
                    long remaining = Math.Max(0, target.KamaCost - contributed);
                    if (remaining == 0)
                    {
                        return CampOperationResult.Fail("Le coût en kamas est déjà entièrement financé.");
                    }
                    if (amount > remaining)
                    {
                        return CampOperationResult.Fail($"Contribution trop élevée : il ne reste que {remaining:N0} kamas.");
                    }
                    if (character.Record.Kamas < amount)
                    {
                        return CampOperationResult.Fail(
                            $"Kamas insuffisants : vous avez {character.Record.Kamas:N0}, " +
                            $"mais la contribution demandée est de {amount:N0}.");
                    }

                    newKamas = character.Record.Kamas - amount;

                    using (MySqlCommand debit = Command(connection, transaction,
                        "UPDATE characters SET Kamas=@kamas WHERE Id=@character",
                        ("@kamas", newKamas), ("@character", character.Id)))
                    {
                        if (debit.ExecuteNonQuery() != 1)
                        {
                            return CampOperationResult.Fail("Impossible de persister le nouveau solde de kamas.");
                        }
                    }

                    Execute(connection, transaction,
                        "UPDATE guild_projects SET KamasContributed=KamasContributed+@amount WHERE Id=@project",
                        ("@amount", amount), ("@project", projectId));
                    Execute(connection, transaction,
                        "INSERT INTO guild_project_contributions " +
                        "(ProjectId,CharacterId,ContributionType,ItemId,Quantity,CreatedAt) " +
                        "VALUES (@project,@character,'KAMAS',NULL,@amount,UTC_TIMESTAMP())",
                        ("@project", projectId), ("@character", character.Id), ("@amount", amount));

                    return CampOperationResult.Ok($"{amount:N0} kamas ajoutés au projet {building.Name} niveau {target.Level}.");
                });

                if (result.Success)
                {
                    character.Record.Kamas = newKamas;
                    character.Inventory.RefreshKamas();
                }
                return result;
            }
        }

        public CampOperationResult ContributeResource(Character character, long buildingId, int itemId, int quantity)
        {
            CampOperationResult? invalid = ValidateMemberAndAmount(character, quantity);
            if (invalid != null)
            {
                return invalid;
            }

            GuildBuildingRecord? building = GuildBuildingRecord.Get(buildingId);
            if (building == null || !building.Enabled)
            {
                return CampOperationResult.Fail("Bâtiment introuvable.");
            }

            lock (guildLocks.GetOrAdd(character.Guild.Id, _ => new object()))
            lock (character.Inventory)
            {
                EnsureGuildState(character.Guild.Id);
                byte level = GetCurrentLevel(character.Guild.Id, buildingId);
                GuildBuildingLevelRecord? target = GuildBuildingLevelRecord.Get(buildingId, (byte)(level + 1));
                if (target == null)
                {
                    return CampOperationResult.Fail("Ce bâtiment est déjà au niveau maximum.");
                }

                long projectId = EnsureActiveProject(character.Guild.Id, buildingId, target);
                CharacterItemRecord[] stacks = character.Inventory.GetItems()
                    .Where(x => x.GId == itemId && !x.IsEquiped())
                    .OrderBy(x => x.Quantity)
                    .ToArray();
                if (stacks.Sum(x => x.Quantity) < quantity)
                {
                    return CampOperationResult.Fail("Vous ne possédez pas assez de cette ressource non équipée.");
                }

                List<(CharacterItemRecord Item, int Quantity)> removal = new();
                int pending = quantity;
                foreach (CharacterItemRecord stack in stacks)
                {
                    int take = Math.Min(stack.Quantity, pending);
                    removal.Add((stack, take));
                    pending -= take;
                    if (pending == 0) break;
                }

                CampOperationResult result = DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
                {
                    using MySqlCommand requirement = Command(connection, transaction,
                        "SELECT RequiredQuantity,ContributedQuantity FROM guild_project_requirements " +
                        "WHERE ProjectId=@project AND ItemId=@item FOR UPDATE",
                        ("@project", projectId), ("@item", itemId));
                    using MySqlDataReader reader = requirement.ExecuteReader();
                    if (!reader.Read())
                    {
                        return CampOperationResult.Fail("Cette ressource n'est pas demandée par le projet.");
                    }
                    int required = reader.GetInt32(0);
                    int contributed = reader.GetInt32(1);
                    reader.Close();
                    int remaining = required - contributed;
                    if (quantity > remaining)
                    {
                        return CampOperationResult.Fail($"Contribution trop élevée : il ne reste que {remaining} unité(s).");
                    }

                    Execute(connection, transaction,
                        "UPDATE guild_project_requirements SET ContributedQuantity=ContributedQuantity+@quantity " +
                        "WHERE ProjectId=@project AND ItemId=@item",
                        ("@quantity", quantity), ("@project", projectId), ("@item", itemId));
                    Execute(connection, transaction,
                        "INSERT INTO guild_project_contributions " +
                        "(ProjectId,CharacterId,ContributionType,ItemId,Quantity,CreatedAt) " +
                        "VALUES (@project,@character,'RESOURCE',@item,@quantity,UTC_TIMESTAMP())",
                        ("@project", projectId), ("@character", character.Id),
                        ("@item", itemId), ("@quantity", quantity));
                    return CampOperationResult.Ok($"{quantity} ressource(s) ajoutée(s) au projet {building.Name} niveau {target.Level}.");
                });

                if (result.Success)
                {
                    foreach ((CharacterItemRecord item, int take) in removal)
                    {
                        character.Inventory.RemoveItem(item, take);
                    }
                }
                return result;
            }
        }

        public CampOperationResult CompleteUpgrade(Character character, long buildingId)
        {
            if (!character.HasGuild || character.Guild == null || character.GuildMember == null)
            {
                return CampOperationResult.Fail("Vous devez appartenir à une guilde.");
            }
            if (!character.GuildMember.HasRight(GuildRightsEnum.RIGHT_MANAGE_RANKS_AND_RIGHTS, character.Guild))
            {
                return CampOperationResult.Fail("Vous n'avez pas le droit de lancer une amélioration de guilde.");
            }

            GuildBuildingRecord? building = GuildBuildingRecord.Get(buildingId);
            if (building == null || !building.Enabled)
            {
                return CampOperationResult.Fail("Bâtiment introuvable.");
            }

            lock (guildLocks.GetOrAdd(character.Guild.Id, _ => new object()))
            {
                EnsureGuildState(character.Guild.Id);
                byte currentLevel = GetCurrentLevel(character.Guild.Id, buildingId);
                GuildBuildingLevelRecord? target = GuildBuildingLevelRecord.Get(buildingId, (byte)(currentLevel + 1));
                if (target == null)
                {
                    return CampOperationResult.Fail("Ce bâtiment est déjà au niveau maximum.");
                }
                long projectId = EnsureActiveProject(character.Guild.Id, buildingId, target);

                CampOperationResult result = DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
                {
                    long contributed = ScalarLong(connection, transaction,
                        "SELECT KamasContributed FROM guild_projects WHERE Id=@project AND Status='ACTIVE' FOR UPDATE",
                        ("@project", projectId));
                    if (contributed < target.KamaCost)
                    {
                        return CampOperationResult.Fail("Le financement en kamas n'est pas terminé.");
                    }
                    if (Exists(connection, transaction,
                        "SELECT 1 FROM guild_project_requirements WHERE ProjectId=@project " +
                        "AND ContributedQuantity<RequiredQuantity LIMIT 1",
                        ("@project", projectId)))
                    {
                        return CampOperationResult.Fail("Toutes les ressources requises n'ont pas encore été réunies.");
                    }

                    using (MySqlCommand advance = Command(connection, transaction,
                        "UPDATE guild_building_states SET Level=@target,UpdatedAt=UTC_TIMESTAMP() " +
                        "WHERE GuildId=@guild AND BuildingId=@building AND Level=@current",
                        ("@target", target.Level), ("@guild", character.Guild.Id),
                        ("@building", buildingId), ("@current", currentLevel)))
                    {
                        if (advance.ExecuteNonQuery() != 1)
                        {
                            throw new InvalidOperationException("Concurrent guild building upgrade detected.");
                        }
                    }
                    Execute(connection, transaction,
                        "UPDATE guild_projects SET Status='COMPLETED',CompletedAt=UTC_TIMESTAMP()," +
                        "CompletedByCharacterId=@character WHERE Id=@project",
                        ("@character", character.Id), ("@project", projectId));
                    return CampOperationResult.Ok($"{building.Name} passe au niveau {target.Level} !");
                });

                if (result.Success)
                {
                    InvalidateEffects(character.Guild.Id);
                    BroadcastState(character, result);
                }
                return result;
            }
        }

        public double ResolvePercent(Character character, string effectType)
        {
            if (character == null || !character.HasGuild || character.Guild == null)
            {
                return 0;
            }

            var key = (character.Guild.Id, effectType);
            return effectCache.GetOrAdd(key, _ =>
            {
                EnsureGuildState(character.Guild.Id);
                return DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
                {
                    using MySqlCommand command = Command(connection, transaction,
                        "SELECT COALESCE(SUM(e.Value),0) FROM guild_building_states s " +
                        "JOIN guild_building_levels l ON l.BuildingId=s.BuildingId AND l.Level=s.Level " +
                        "JOIN guild_building_effects e ON e.BuildingLevelId=l.Id " +
                        "WHERE s.GuildId=@guild AND e.EffectType=@type",
                        ("@guild", character.Guild.Id), ("@type", effectType));
                    return Convert.ToDouble(command.ExecuteScalar() ?? 0);
                });
            });
        }

        private string BuildStateJson(Character character, CampOperationResult? operation)
        {
            long guildId = character.Guild.Id;
            EnsureGuildState(guildId);
            bool canUpgrade = character.GuildMember != null &&
                character.GuildMember.HasRight(GuildRightsEnum.RIGHT_MANAGE_RANKS_AND_RIGHTS, character.Guild);

            var buildings = GuildBuildingRecord.GetAll().Select(building =>
            {
                byte level = GetCurrentLevel(guildId, building.Id);
                GuildBuildingLevelRecord current = GuildBuildingLevelRecord.Get(building.Id, level)!;
                GuildBuildingLevelRecord? next = GuildBuildingLevelRecord.Get(building.Id, (byte)(level + 1));
                ProjectSnapshot? project = next == null ? null : ReadProject(
                    character,
                    EnsureActiveProject(guildId, building.Id, next),
                    next.KamaCost);

                return new
                {
                    id = building.Id,
                    code = building.Code,
                    name = building.Name,
                    description = building.Description,
                    level,
                    maxLevel = GuildBuildingLevelRecord.GetAll(building.Id).Max(x => x.Level),
                    assetPath = current.AssetPath,
                    overlay = new { x = building.OverlayX, y = building.OverlayY, width = building.OverlayWidth, height = building.OverlayHeight },
                    effects = Effects(current),
                    nextLevel = next == null ? null : new
                    {
                        level = next.Level,
                        kamaCost = next.KamaCost,
                        assetPath = next.AssetPath,
                        effects = Effects(next)
                    },
                    project,
                    canUpgrade
                };
            }).ToArray();

            return JsonSerializer.Serialize(new
            {
                version = 1,
                guildId,
                guildName = character.Guild.Record.Name,
                kamas = character.Record.Kamas,
                campBackground = "Giny_GuildCamp/assets/camp-background.png",
                operation = operation == null ? null : new { success = operation.Success, message = operation.Message },
                buildings
            }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        }

        private static object[] Effects(GuildBuildingLevelRecord level) =>
            GuildBuildingEffectRecord.GetAll(level.Id)
                .Select(effect => (object)new
                {
                    type = effect.EffectType,
                    value = effect.Value,
                    description = effect.Description,
                    parameters = effect.Parameters
                }).ToArray();

        private ProjectSnapshot ReadProject(Character character, long projectId, long kamaCost)
        {
            return DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                long contributed = ScalarLong(connection, transaction,
                    "SELECT KamasContributed FROM guild_projects WHERE Id=@project", ("@project", projectId));
                List<ResourceSnapshot> requirements = new();
                using MySqlCommand command = Command(connection, transaction,
                    "SELECT ItemId,RequiredQuantity,ContributedQuantity FROM guild_project_requirements " +
                    "WHERE ProjectId=@project ORDER BY Id", ("@project", projectId));
                using MySqlDataReader reader = command.ExecuteReader();
                while (reader.Read())
                {
                    int itemId = reader.GetInt32(0);
                    int required = reader.GetInt32(1);
                    int current = reader.GetInt32(2);
                    int owned = character.Inventory.GetItems().Where(x => x.GId == itemId && !x.IsEquiped()).Sum(x => x.Quantity);
                    requirements.Add(new ResourceSnapshot(
                        itemId,
                        ItemRecord.GetItem(itemId)?.Name ?? $"Objet {itemId}",
                        required,
                        current,
                        owned));
                }
                bool ready = contributed >= kamaCost && requirements.All(x => x.ContributedQuantity >= x.RequiredQuantity);
                return new ProjectSnapshot(projectId, contributed, kamaCost, ready, requirements.ToArray());
            });
        }

        private void EnsureGuildState(long guildId)
        {
            DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                foreach (GuildBuildingRecord building in GuildBuildingRecord.GetAll())
                {
                    Execute(connection, transaction,
                        "INSERT IGNORE INTO guild_building_states (GuildId,BuildingId,Level,UpdatedAt) " +
                        "VALUES (@guild,@building,1,UTC_TIMESTAMP())",
                        ("@guild", guildId), ("@building", building.Id));
                }
                return true;
            });
        }

        private long EnsureActiveProject(long guildId, long buildingId, GuildBuildingLevelRecord target)
        {
            return DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                long id = ScalarLong(connection, transaction,
                    "SELECT Id FROM guild_projects WHERE GuildId=@guild AND BuildingId=@building " +
                    "AND TargetLevel=@target LIMIT 1 FOR UPDATE",
                    ("@guild", guildId), ("@building", buildingId), ("@target", target.Level));
                if (id != 0)
                {
                    return id;
                }

                using MySqlCommand insert = Command(connection, transaction,
                    "INSERT INTO guild_projects (GuildId,BuildingId,TargetLevel,Status,KamasContributed,CreatedAt) " +
                    "VALUES (@guild,@building,@target,'ACTIVE',0,UTC_TIMESTAMP())",
                    ("@guild", guildId), ("@building", buildingId), ("@target", target.Level));
                insert.ExecuteNonQuery();
                id = insert.LastInsertedId;

                foreach (GuildBuildingLevelRequirementRecord requirement in GuildBuildingLevelRequirementRecord.GetAll(target.Id))
                {
                    Execute(connection, transaction,
                        "INSERT INTO guild_project_requirements " +
                        "(ProjectId,ItemId,RequiredQuantity,ContributedQuantity) VALUES (@project,@item,@quantity,0)",
                        ("@project", id), ("@item", requirement.ItemId), ("@quantity", requirement.RequiredQuantity));
                }
                return id;
            });
        }

        private byte GetCurrentLevel(long guildId, long buildingId)
        {
            long value = DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
                ScalarLong(connection, transaction,
                    "SELECT Level FROM guild_building_states WHERE GuildId=@guild AND BuildingId=@building",
                    ("@guild", guildId), ("@building", buildingId)));
            return checked((byte)value);
        }

        private void BroadcastState(Character initiator, CampOperationResult operation)
        {
            foreach (var member in initiator.Guild.Record.Members)
            {
                Character? online = initiator.Guild.GetOnlineMember(member.CharacterId);
                if (online != null)
                {
                    if (online.Id != initiator.Id)
                    {
                        online.Reply(operation.Message);
                    }
                    SendState(online, operation);
                }
            }
        }

        private void InvalidateEffects(long guildId)
        {
            foreach (var key in effectCache.Keys.Where(x => x.GuildId == guildId))
            {
                effectCache.TryRemove(key, out _);
            }
        }

        private static CampOperationResult? ValidateMemberAndAmount(Character character, long amount)
        {
            if (!character.HasGuild || character.Guild == null || character.GuildMember == null)
            {
                return CampOperationResult.Fail("Vous devez appartenir à une guilde.");
            }
            if (amount <= 0)
            {
                return CampOperationResult.Fail("La contribution doit être strictement positive.");
            }
            return null;
        }

        private static MySqlCommand Command(MySqlConnection connection, MySqlTransaction transaction, string sql,
            params (string Name, object? Value)[] parameters)
        {
            MySqlCommand command = new(sql, connection, transaction);
            foreach ((string name, object? value) in parameters)
            {
                command.Parameters.AddWithValue(name, value ?? DBNull.Value);
            }
            return command;
        }

        private static int Execute(MySqlConnection connection, MySqlTransaction transaction, string sql,
            params (string Name, object? Value)[] parameters)
        {
            using MySqlCommand command = Command(connection, transaction, sql, parameters);
            return command.ExecuteNonQuery();
        }

        private static long ScalarLong(MySqlConnection connection, MySqlTransaction transaction, string sql,
            params (string Name, object? Value)[] parameters)
        {
            using MySqlCommand command = Command(connection, transaction, sql, parameters);
            object? value = command.ExecuteScalar();
            return value == null || value is DBNull ? 0 : Convert.ToInt64(value);
        }

        private static bool Exists(MySqlConnection connection, MySqlTransaction transaction, string sql,
            params (string Name, object? Value)[] parameters)
        {
            using MySqlCommand command = Command(connection, transaction, sql, parameters);
            return command.ExecuteScalar() != null;
        }

        private sealed record ProjectSnapshot(long Id, long KamasContributed, long KamaCost, bool Ready, ResourceSnapshot[] Requirements);
        private sealed record ResourceSnapshot(int ItemId, string Name, int RequiredQuantity, int ContributedQuantity, int OwnedQuantity);
    }
}
