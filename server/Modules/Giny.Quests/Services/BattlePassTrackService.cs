using Giny.World.Managers.Items;
using Giny.ORM;
using Giny.Quests.Data;
using Giny.Quests.Domain;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Records.Items;
using MySql.Data.MySqlClient;

namespace Giny.Quests.Services
{
    internal sealed record BattlePassSeason(
        long Id,
        string Code,
        string Name,
        DateTimeOffset StartsAt,
        DateTimeOffset EndsAt,
        int ExperiencePerLevel,
        int LevelCount);

    internal sealed record BattlePassRewardDefinition(
        int Level,
        string Track,
        string RewardType,
        long Amount,
        int? ItemId,
        string Label,
        string ShortLabel);

    internal sealed class BattlePassTrackService
    {
        public static object BuildState(long playerId, long experience, bool vip)
        {
            BattlePassSeason? season = LoadActiveSeason();
            if (season == null)
            {
                return new
                {
                    experience,
                    experiencePerLevel = 1000,
                    currentXp = BattlePassRules.ProgressInLevel(experience, 1000),
                    xpRequired = 1000,
                    level = BattlePassRules.CurrentLevel(experience, 1000),
                    unlockedLevels = BattlePassRules.UnlockedLevels(experience, 1000),
                    vip,
                    seasonId = 0,
                    seasonName = "",
                    seasonEndsUnix = 0,
                    levelCount = 0,
                    levels = Array.Empty<object>(),
                };
            }

            int unlocked = BattlePassRules.UnlockedLevels(experience, season.ExperiencePerLevel);
            HashSet<string> claims = LoadClaims(playerId, season.Id);
            Dictionary<(int Level, string Track), BattlePassRewardDefinition> rewards = LoadRewards(season.Id);

            object[] levels = Enumerable.Range(1, season.LevelCount).Select(level =>
            {
                bool unlockedLevel = unlocked >= level;
                return new
                {
                    level,
                    unlocked = unlockedLevel,
                    free = BuildSlot(rewards, claims, level, BattlePassTracks.Free, unlockedLevel, vip),
                    vip = BuildSlot(rewards, claims, level, BattlePassTracks.Vip, unlockedLevel, vip),
                };
            }).ToArray();

            return new
            {
                experience,
                experiencePerLevel = season.ExperiencePerLevel,
                currentXp = BattlePassRules.ProgressInLevel(experience, season.ExperiencePerLevel),
                xpRequired = season.ExperiencePerLevel,
                level = Math.Min(season.LevelCount, BattlePassRules.CurrentLevel(experience, season.ExperiencePerLevel)),
                unlockedLevels = Math.Min(season.LevelCount, unlocked),
                vip,
                seasonId = season.Id,
                seasonName = season.Name,
                seasonEndsUnix = season.EndsAt.ToUnixTimeSeconds(),
                levelCount = season.LevelCount,
                levels,
            };
        }

        public static QuestClaimResult Claim(Character character, int level, string track)
        {
            string normalized = track.Trim().ToUpperInvariant();
            if (normalized is not (BattlePassTracks.Free or BattlePassTracks.Vip))
            {
                return new QuestClaimResult(false, "Usage : .bpclaim <niveau> free|vip");
            }

            QuestSession session = QuestGenerationService.Instance.EnsurePeriods(character);
            lock (session.SyncRoot)
            lock (character.KamasSyncRoot)
            lock (DatabaseManager.DatabaseLocker)
            {
                BattlePassSeason? season = LoadActiveSeason();
                if (season == null)
                {
                    return new QuestClaimResult(false, "Aucune saison Battle Pass n'est active.");
                }

                if (level < 1 || level > season.LevelCount)
                {
                    return new QuestClaimResult(false, "Niveau Battle Pass invalide.");
                }

                int unlocked = BattlePassRules.UnlockedLevels(session.BattlePassExperience, season.ExperiencePerLevel);
                if (!BattlePassRules.CanClaim(unlocked, level, normalized, session.BattlePassVip, claimed: false))
                {
                    if (unlocked < level)
                    {
                        return new QuestClaimResult(false, "Ce niveau n'est pas encore atteint.");
                    }

                    if (normalized == BattlePassTracks.Vip && !session.BattlePassVip)
                    {
                        return new QuestClaimResult(false, "Récompense VIP : passe requis.");
                    }
                }

                List<(int ItemId, int Quantity)> items = new();
                CharacterItemRecord[] committedItems = Array.Empty<CharacterItemRecord>();
                QuestClaimResult result = DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
                {
                    if (!session.BattlePassVip && normalized == BattlePassTracks.Vip)
                    {
                        return new QuestClaimResult(false, "Récompense VIP : passe requis.");
                    }

                    using MySqlCommand existing = QuestRepository.Command(connection, transaction,
                        "SELECT 1 FROM player_battle_pass_claims " +
                        "WHERE PlayerId=@player AND SeasonId=@season AND Level=@level AND Track=@track FOR UPDATE",
                        ("@player", character.Id), ("@season", season.Id), ("@level", level), ("@track", normalized));
                    object? claimed = existing.ExecuteScalar();
                    if (claimed != null && claimed != DBNull.Value)
                    {
                        return new QuestClaimResult(false, "Cette récompense a déjà été récupérée.");
                    }

                    long kamas = 0;
                    long xp = 0;
                    using MySqlCommand rewards = QuestRepository.Command(connection, transaction,
                        "SELECT RewardType,Amount,ItemId FROM battle_pass_rewards " +
                        "WHERE SeasonId=@season AND Level=@level AND Track=@track ORDER BY DisplayOrder,Id",
                        ("@season", season.Id), ("@level", level), ("@track", normalized));
                    using (MySqlDataReader reader = rewards.ExecuteReader())
                    {
                        if (!reader.HasRows)
                        {
                            return new QuestClaimResult(false, "Aucune récompense configurée pour ce palier.");
                        }

                        while (reader.Read())
                        {
                            string type = reader.GetString(0);
                            long amount = reader.GetInt64(1);
                            if (amount <= 0) throw new InvalidDataException("Reward amount must be positive.");
                            switch (type)
                            {
                                case QuestRewardTypes.Kamas: kamas = checked(kamas + amount); break;
                                case QuestRewardTypes.PlayerXp: xp = checked(xp + amount); break;
                                case QuestRewardTypes.Item when !reader.IsDBNull(2):
                                    items.Add((reader.GetInt32(2), checked((int)amount)));
                                    break;
                                default:
                                    throw new InvalidDataException($"Unsupported battle pass reward type '{type}'.");
                            }
                        }
                    }

                    if (kamas > Giny.World.Managers.Items.Collections.Inventory.MaximumKamas - character.Record.Kamas)
                        throw new ArgumentException("La limite de kamas serait dépassée. Libérez de la place avant de récupérer cette récompense.");
                    if (kamas > 0 || xp > 0)
                    {
                        if (QuestRepository.Execute(connection, transaction,
                            "UPDATE characters SET Kamas=@kamas,Experience=@xp WHERE Id=@player",
                            ("@kamas", checked(character.Record.Kamas + kamas)), ("@xp", checked(character.Experience + xp)), ("@player", character.Id)) != 1)
                        {
                            throw new InvalidOperationException("Unable to persist the battle pass rewards.");
                        }
                    }

                    if (QuestRepository.Execute(connection, transaction,
                        "INSERT INTO player_battle_pass_claims (PlayerId,SeasonId,Level,Track,ClaimedAt) " +
                        "VALUES (@player,@season,@level,@track,UTC_TIMESTAMP())",
                        ("@player", character.Id), ("@season", season.Id), ("@level", level), ("@track", normalized)) != 1)
                    {
                        throw new InvalidOperationException("Concurrent battle pass claim rejected.");
                    }

                    committedItems = TransactionalItemRewards.Insert(character.Id, items, connection, transaction);
                    return new QuestClaimResult(true, "Récompense Battle Pass récupérée", kamas, xp);
                });

                if (!result.Success)
                {
                    return result;
                }

                if (result.Kamas > 0)
                {
                    character.Record.Kamas += result.Kamas;
                    character.Inventory.RefreshKamas();
                }

                if (result.PlayerXp > 0)
                {
                    character.AddExperience(result.PlayerXp);
                }

                character.Inventory.AttachCommittedRewards(committedItems);

                character.DisplayNotification(BuildNotification(result, items));
                QuestStateService.Instance.SendState(character, session, "BPCLAIM");
                return result;
            }
        }

        public static void SetVip(Character character, bool vip)
        {
            DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                QuestRepository.Execute(connection, transaction,
                    "INSERT INTO player_battle_pass_progress (PlayerId,Experience,Vip,UpdatedAt) " +
                    "VALUES (@player,0,@vip,UTC_TIMESTAMP()) " +
                    "ON DUPLICATE KEY UPDATE Vip=@vip,UpdatedAt=UTC_TIMESTAMP()",
                    ("@player", character.Id), ("@vip", vip ? 1 : 0));
                return true;
            });

            QuestSession session = QuestGenerationService.Instance.EnsurePeriods(character);
            lock (session.SyncRoot)
            {
                session.BattlePassVip = vip;
            }

            QuestStateService.Instance.SendState(character, session, "BPVIP");
        }

        private static object BuildSlot(
            Dictionary<(int Level, string Track), BattlePassRewardDefinition> rewards,
            HashSet<string> claims,
            int level,
            string track,
            bool unlocked,
            bool vip)
        {
            rewards.TryGetValue((level, track), out BattlePassRewardDefinition? reward);
            bool claimed = claims.Contains(ClaimKey(level, track));
            bool vipLocked = track == BattlePassTracks.Vip && !vip;
            return new
            {
                type = reward?.RewardType ?? "",
                amount = reward?.Amount ?? 0,
                itemId = reward?.ItemId,
                label = reward?.Label ?? "",
                shortLabel = reward?.ShortLabel ?? "",
                claimed,
                claimable = BattlePassRules.CanClaim(unlocked ? level : 0, level, track, vip, claimed) && reward != null,
                locked = !unlocked || vipLocked,
                lockedReason = !unlocked ? "LOCKED" : vipLocked ? "VIP" : "",
            };
        }

        private static BattlePassSeason? LoadActiveSeason()
        {
            return DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                using MySqlCommand command = QuestRepository.Command(connection, transaction,
                    "SELECT Id,Code,Name,StartsAt,EndsAt,ExperiencePerLevel,LevelCount " +
                    "FROM battle_pass_seasons WHERE Enabled=1 " +
                    "AND StartsAt<=UTC_TIMESTAMP() AND EndsAt>=UTC_TIMESTAMP() " +
                    "ORDER BY StartsAt DESC LIMIT 1");
                using MySqlDataReader reader = command.ExecuteReader();
                if (!reader.Read())
                {
                    return null;
                }

                return new BattlePassSeason(
                    reader.GetInt64(0),
                    reader.GetString(1),
                    reader.GetString(2),
                    new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(3), DateTimeKind.Utc)),
                    new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(4), DateTimeKind.Utc)),
                    reader.GetInt32(5),
                    reader.GetInt32(6));
            });
        }

        private static Dictionary<(int Level, string Track), BattlePassRewardDefinition> LoadRewards(long seasonId)
        {
            return DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                Dictionary<(int, string), BattlePassRewardDefinition> rewards = new();
                using MySqlCommand command = QuestRepository.Command(connection, transaction,
                    "SELECT Level,Track,RewardType,Amount,ItemId,Label,ShortLabel " +
                    "FROM battle_pass_rewards WHERE SeasonId=@season ORDER BY Level,Track,DisplayOrder,Id",
                    ("@season", seasonId));
                using MySqlDataReader reader = command.ExecuteReader();
                while (reader.Read())
                {
                    var key = (reader.GetInt32(0), reader.GetString(1));
                    if (rewards.ContainsKey(key))
                    {
                        continue;
                    }

                    rewards[key] = new BattlePassRewardDefinition(
                        key.Item1,
                        key.Item2,
                        reader.GetString(2),
                        reader.GetInt64(3),
                        reader.IsDBNull(4) ? null : reader.GetInt32(4),
                        reader.GetString(5),
                        reader.GetString(6));
                }

                return rewards;
            });
        }

        private static HashSet<string> LoadClaims(long playerId, long seasonId)
        {
            return DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
            {
                HashSet<string> claims = new(StringComparer.Ordinal);
                using MySqlCommand command = QuestRepository.Command(connection, transaction,
                    "SELECT Level,Track FROM player_battle_pass_claims WHERE PlayerId=@player AND SeasonId=@season",
                    ("@player", playerId), ("@season", seasonId));
                using MySqlDataReader reader = command.ExecuteReader();
                while (reader.Read())
                {
                    claims.Add(ClaimKey(reader.GetInt32(0), reader.GetString(1)));
                }

                return claims;
            });
        }

        private static string ClaimKey(int level, string track) => $"{level}:{track}";

        private static string BuildNotification(QuestClaimResult result, IReadOnlyList<(int ItemId, int Quantity)> items)
        {
            List<string> parts = new();
            if (result.Kamas > 0) parts.Add($"{result.Kamas:N0} kamas");
            if (result.PlayerXp > 0) parts.Add($"{result.PlayerXp:N0} XP");
            foreach ((int itemId, int quantity) in items)
            {
                string name = ItemRecord.GetItem(itemId)?.Name ?? $"objet #{itemId}";
                parts.Add($"{quantity:N0} × {name}");
            }

            return "Récompense Battle Pass récupérée" + (parts.Count > 0 ? " : " + string.Join(", ", parts) : string.Empty);
        }
    }
}
