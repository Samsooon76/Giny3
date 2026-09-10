using Giny.ORM;
using Giny.Quests.Data.Records;
using Giny.Quests.Domain;
using MySql.Data.MySqlClient;

namespace Giny.Quests.Data
{
    internal sealed class QuestRepository
    {
        public IReadOnlyList<PlayerQuest> LoadForSession(long playerId, string dailyKey, string weeklyKey)
        {
            return DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                List<PlayerQuest> quests = new();
                using MySqlCommand command = Command(connection, transaction,
                    "SELECT Id,PlayerId,TemplateId,Period,PeriodKey,ObjectiveType,Category,Title,Description," +
                    "TargetAmount,CurrentAmount,TargetEntityId,TargetFamilyId,TargetZoneId,TargetDungeonId," +
                    "TargetResourceId,TargetRecipeId,TargetPokefusRarity,Parameters,Completed,CompletedAt," +
                    "RewardClaimed,RewardClaimedAt,GeneratedAt,ExpiresAt,SlotNumber " +
                    "FROM player_quests WHERE PlayerId=@player AND " +
                    "((Period='DAILY' AND PeriodKey=@daily) OR (Period='WEEKLY' AND PeriodKey=@weekly) OR " +
                    "(Completed=1 AND RewardClaimed=0 AND ExpiresAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY))) " +
                    "ORDER BY GeneratedAt DESC,Period,SlotNumber",
                    ("@player", playerId), ("@daily", dailyKey), ("@weekly", weeklyKey));
                using (MySqlDataReader reader = command.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        quests.Add(ReadQuest(reader));
                    }
                }

                if (quests.Count == 0)
                {
                    return quests;
                }

                string ids = string.Join(',', quests.Select(x => x.Id));
                using MySqlCommand rewards = Command(connection, transaction,
                    "SELECT Id,PlayerQuestId,RewardType,Amount,ItemId,Parameters,DisplayOrder " +
                    $"FROM player_quest_rewards WHERE PlayerQuestId IN ({ids}) ORDER BY DisplayOrder,Id");
                Dictionary<long, PlayerQuest> byId = quests.ToDictionary(x => x.Id);
                using MySqlDataReader rewardReader = rewards.ExecuteReader();
                while (rewardReader.Read())
                {
                    PlayerQuestReward reward = new()
                    {
                        Id = rewardReader.GetInt64(0),
                        PlayerQuestId = rewardReader.GetInt64(1),
                        RewardType = rewardReader.GetString(2),
                        Amount = rewardReader.GetInt64(3),
                        ItemId = rewardReader.IsDBNull(4) ? null : rewardReader.GetInt32(4),
                        Parameters = rewardReader.GetString(5),
                        DisplayOrder = rewardReader.GetInt32(6),
                    };
                    if (byId.TryGetValue(reward.PlayerQuestId, out PlayerQuest? quest))
                    {
                        quest.Rewards.Add(reward);
                    }
                }
                return quests;
            });
        }

        public int GetGeneratedCount(long playerId, QuestPeriodWindow window)
        {
            return DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                using MySqlCommand command = Command(connection, transaction,
                    "SELECT COUNT(*) FROM player_quests WHERE PlayerId=@player AND Period=@period AND PeriodKey=@key",
                    ("@player", playerId), ("@period", window.Period), ("@key", window.Key));
                return Convert.ToInt32(command.ExecuteScalar());
            });
        }

        public (long Experience, bool Vip) GetBattlePassProgress(long playerId)
        {
            return DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                using MySqlCommand command = Command(connection, transaction,
                    "SELECT COALESCE(Experience,0),COALESCE(Vip,0) FROM player_battle_pass_progress WHERE PlayerId=@player",
                    ("@player", playerId));
                using MySqlDataReader reader = command.ExecuteReader();
                if (!reader.Read())
                {
                    return (0L, false);
                }

                return (reader.GetInt64(0), reader.GetBoolean(1));
            });
        }

        public void InsertGenerated(long playerId, QuestPeriodWindow window, IReadOnlyList<QuestDraft> drafts)
        {
            if (drafts.Count == 0)
            {
                return;
            }

            DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                HashSet<int> occupiedSlots = new();
                HashSet<long> existingTemplates = new();
                using (MySqlCommand existing = Command(connection, transaction,
                    "SELECT SlotNumber,TemplateId FROM player_quests WHERE PlayerId=@player AND Period=@period AND PeriodKey=@key FOR UPDATE",
                    ("@player", playerId), ("@period", window.Period), ("@key", window.Key)))
                using (MySqlDataReader reader = existing.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        occupiedSlots.Add(reader.GetInt32(0));
                        existingTemplates.Add(reader.GetInt64(1));
                    }
                }

                foreach (QuestDraft draft in drafts.Where(x => !existingTemplates.Contains(x.Template.Id)))
                {
                    int slot = Enumerable.Range(1, 3).FirstOrDefault(x => !occupiedSlots.Contains(x));
                    if (slot == 0)
                    {
                        break;
                    }

                    using MySqlCommand insert = Command(connection, transaction,
                        "INSERT INTO player_quests " +
                        "(PlayerId,TemplateId,Period,PeriodKey,ObjectiveType,Category,Title,Description,TargetAmount,CurrentAmount," +
                        "TargetEntityId,TargetFamilyId,TargetZoneId,TargetDungeonId,TargetResourceId,TargetRecipeId,TargetPokefusRarity," +
                        "Parameters,Completed,CompletedAt,RewardClaimed,RewardClaimedAt,GeneratedAt,ExpiresAt,SlotNumber) " +
                        "VALUES (@player,@template,@period,@key,@objective,@category,@title,@description,@target,0," +
                        "@entity,@family,@zone,@dungeon,@resource,@recipe,@rarity,@parameters,0,NULL,0,NULL,UTC_TIMESTAMP(),@expires,@slot)",
                        ("@player", playerId), ("@template", draft.Template.Id), ("@period", window.Period),
                        ("@key", window.Key), ("@objective", draft.Template.ObjectiveType),
                        ("@category", draft.Template.Category), ("@title", draft.Title),
                        ("@description", draft.Description), ("@target", draft.Template.TargetAmount),
                        ("@entity", draft.TargetEntityId), ("@family", draft.TargetFamilyId),
                        ("@zone", draft.Template.TargetZoneId), ("@dungeon", draft.TargetDungeonId),
                        ("@resource", draft.Template.TargetResourceId), ("@recipe", draft.Template.TargetRecipeId),
                        ("@rarity", draft.Template.TargetPokefusRarity), ("@parameters", draft.Template.Parameters),
                        ("@expires", window.ExpiresAt.UtcDateTime), ("@slot", slot));
                    insert.ExecuteNonQuery();
                    long playerQuestId = insert.LastInsertedId;

                    foreach (QuestRewardRecord reward in QuestRewardRecord.GetForTemplate(draft.Template.Id))
                    {
                        Execute(connection, transaction,
                            "INSERT INTO player_quest_rewards (PlayerQuestId,RewardType,Amount,ItemId,Parameters,DisplayOrder) " +
                            "VALUES (@quest,@type,@amount,@item,@parameters,@order)",
                            ("@quest", playerQuestId), ("@type", reward.RewardType), ("@amount", reward.Amount),
                            ("@item", reward.ItemId), ("@parameters", reward.Parameters), ("@order", reward.DisplayOrder));
                    }

                    occupiedSlots.Add(slot);
                    existingTemplates.Add(draft.Template.Id);
                }
                return true;
            });
        }

        public IReadOnlyList<QuestProgressResult> ApplyProgress(long playerId, IReadOnlyList<(PlayerQuest Quest, int Amount)> changes)
        {
            if (changes.Count == 0)
            {
                return Array.Empty<QuestProgressResult>();
            }

            return DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                List<QuestProgressResult> results = new();
                foreach ((PlayerQuest quest, int amount) in changes.Where(x => x.Amount > 0))
                {
                    using MySqlCommand update = Command(connection, transaction,
                        "UPDATE player_quests SET " +
                        "Completed=IF(CurrentAmount+@amount>=TargetAmount,1,Completed)," +
                        "CompletedAt=IF(CurrentAmount+@amount>=TargetAmount,COALESCE(CompletedAt,UTC_TIMESTAMP()),CompletedAt)," +
                        "CurrentAmount=LEAST(TargetAmount,CurrentAmount+@amount) " +
                        "WHERE Id=@id AND PlayerId=@player AND Completed=0 AND ExpiresAt>UTC_TIMESTAMP()",
                        ("@amount", amount), ("@id", quest.Id), ("@player", playerId));
                    if (update.ExecuteNonQuery() == 0)
                    {
                        continue;
                    }

                    using MySqlCommand read = Command(connection, transaction,
                        "SELECT CurrentAmount,Completed,CompletedAt FROM player_quests WHERE Id=@id",
                        ("@id", quest.Id));
                    using MySqlDataReader reader = read.ExecuteReader();
                    if (reader.Read())
                    {
                        results.Add(new QuestProgressResult(
                            quest.Id,
                            reader.GetInt32(0),
                            reader.GetBoolean(1),
                            reader.IsDBNull(2) ? null : reader.GetDateTime(2)));
                    }
                }
                return results;
            });
        }

        public void DeletePeriod(long playerId, QuestPeriodWindow window)
        {
            DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                Execute(connection, transaction,
                    "DELETE FROM player_quests WHERE PlayerId=@player AND Period=@period AND PeriodKey=@key",
                    ("@player", playerId), ("@period", window.Period), ("@key", window.Key));
                return true;
            });
        }

        internal static MySqlCommand Command(MySqlConnection connection, MySqlTransaction transaction, string sql,
            params (string Name, object? Value)[] parameters)
        {
            MySqlCommand command = new(sql, connection, transaction);
            foreach ((string name, object? value) in parameters)
            {
                command.Parameters.AddWithValue(name, value ?? DBNull.Value);
            }
            return command;
        }

        internal static int Execute(MySqlConnection connection, MySqlTransaction transaction, string sql,
            params (string Name, object? Value)[] parameters)
        {
            using MySqlCommand command = Command(connection, transaction, sql, parameters);
            return command.ExecuteNonQuery();
        }

        private static PlayerQuest ReadQuest(MySqlDataReader reader) => new()
        {
            Id = reader.GetInt64(0),
            PlayerId = reader.GetInt64(1),
            TemplateId = reader.GetInt64(2),
            Period = reader.GetString(3),
            PeriodKey = reader.GetString(4),
            ObjectiveType = reader.GetString(5),
            Category = reader.GetString(6),
            Title = reader.GetString(7),
            Description = reader.GetString(8),
            TargetAmount = reader.GetInt32(9),
            CurrentAmount = reader.GetInt32(10),
            TargetEntityId = reader.IsDBNull(11) ? null : reader.GetInt64(11),
            TargetFamilyId = reader.IsDBNull(12) ? null : reader.GetInt64(12),
            TargetZoneId = reader.IsDBNull(13) ? null : reader.GetInt64(13),
            TargetDungeonId = reader.IsDBNull(14) ? null : reader.GetInt64(14),
            TargetResourceId = reader.IsDBNull(15) ? null : reader.GetInt64(15),
            TargetRecipeId = reader.IsDBNull(16) ? null : reader.GetInt64(16),
            TargetPokefusRarity = reader.IsDBNull(17) ? null : reader.GetString(17),
            Parameters = reader.GetString(18),
            Completed = reader.GetBoolean(19),
            CompletedAt = reader.IsDBNull(20) ? null : reader.GetDateTime(20),
            RewardClaimed = reader.GetBoolean(21),
            RewardClaimedAt = reader.IsDBNull(22) ? null : reader.GetDateTime(22),
            GeneratedAt = reader.GetDateTime(23),
            ExpiresAt = reader.GetDateTime(24),
            SlotNumber = reader.GetInt32(25),
        };
    }

    internal sealed record QuestDraft(
        QuestTemplateRecord Template,
        string Title,
        string Description,
        long? TargetEntityId,
        long? TargetFamilyId,
        long? TargetDungeonId);

    internal sealed record QuestProgressResult(long QuestId, int CurrentAmount, bool Completed, DateTime? CompletedAt);
}
