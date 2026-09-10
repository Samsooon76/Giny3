using Giny.World.Managers.Items;
using Giny.World.Records.Items;
using Giny.Core.DesignPattern;
using Giny.ORM;
using Giny.Quests.Data;
using Giny.Quests.Domain;
using Giny.World.Managers.Entities.Characters;
using MySql.Data.MySqlClient;

namespace Giny.Quests.Services
{
    public interface IBattlePassRewardService
    {
        void Grant(MySqlConnection connection, MySqlTransaction transaction, long playerId, long amount);
    }

    internal sealed class LedgerBattlePassRewardService : IBattlePassRewardService
    {
        public void Grant(MySqlConnection connection, MySqlTransaction transaction, long playerId, long amount)
        {
            QuestRepository.Execute(connection, transaction,
                "INSERT INTO player_battle_pass_progress (PlayerId,Experience,UpdatedAt) VALUES (@player,@amount,UTC_TIMESTAMP()) " +
                "ON DUPLICATE KEY UPDATE Experience=Experience+VALUES(Experience),UpdatedAt=UTC_TIMESTAMP()",
                ("@player", playerId), ("@amount", amount));
        }
    }

    internal sealed record QuestClaimResult(bool Success, string Message, long Kamas = 0, long PlayerXp = 0, long BattlePassXp = 0);

    internal sealed class QuestRewardService : Singleton<QuestRewardService>
    {
        public IBattlePassRewardService BattlePass { get; set; } = new LedgerBattlePassRewardService();

        public QuestClaimResult Claim(Character character, long questId)
        {
            QuestSession session = QuestGenerationService.Instance.EnsurePeriods(character);
            lock (session.SyncRoot)
            lock (character.KamasSyncRoot)
            lock (DatabaseManager.DatabaseLocker)
            {
                PlayerQuest? cached = session.Quests.FirstOrDefault(x => x.Id == questId);
                if (cached == null)
                {
                    return new QuestClaimResult(false, "Quête introuvable.");
                }

                List<(int ItemId, int Quantity)> itemRewards = new();
                CharacterItemRecord[] committedItems = Array.Empty<CharacterItemRecord>();
                QuestClaimResult result = DatabaseManager.Instance.ExecuteTransaction((connection, transaction) =>
                {
                    using MySqlCommand lockQuest = QuestRepository.Command(connection, transaction,
                        "SELECT Completed,RewardClaimed FROM player_quests WHERE Id=@id AND PlayerId=@player FOR UPDATE",
                        ("@id", questId), ("@player", character.Id));
                    using MySqlDataReader questReader = lockQuest.ExecuteReader();
                    if (!questReader.Read())
                    {
                        return new QuestClaimResult(false, "Quête introuvable.");
                    }
                    bool completed = questReader.GetBoolean(0);
                    bool claimed = questReader.GetBoolean(1);
                    questReader.Close();
                    if (!completed) return new QuestClaimResult(false, "Cette quête n'est pas terminée.");
                    if (claimed) return new QuestClaimResult(false, "Cette récompense a déjà été récupérée.");

                    long kamas = 0;
                    long xp = 0;
                    long battlePassXp = 0;
                    using MySqlCommand rewards = QuestRepository.Command(connection, transaction,
                        "SELECT RewardType,Amount,ItemId FROM player_quest_rewards WHERE PlayerQuestId=@quest ORDER BY DisplayOrder,Id",
                        ("@quest", questId));
                    using (MySqlDataReader rewardReader = rewards.ExecuteReader())
                    {
                        while (rewardReader.Read())
                        {
                            string type = rewardReader.GetString(0);
                            long amount = rewardReader.GetInt64(1);
                            if (amount <= 0) throw new InvalidDataException("Reward amount must be positive.");
                            switch (type)
                            {
                                case QuestRewardTypes.Kamas: kamas = checked(kamas + amount); break;
                                case QuestRewardTypes.PlayerXp: xp = checked(xp + amount); break;
                                case QuestRewardTypes.BattlePassXp: battlePassXp = checked(battlePassXp + amount); break;
                                case QuestRewardTypes.Item when !rewardReader.IsDBNull(2):
                                    itemRewards.Add((rewardReader.GetInt32(2), checked((int)amount)));
                                    break;
                                default:
                                    throw new InvalidDataException($"Unsupported quest reward type '{type}'.");
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
                            throw new InvalidOperationException("Unable to persist the character quest rewards.");
                        }
                    }
                    if (battlePassXp > 0)
                    {
                        BattlePass.Grant(connection, transaction, character.Id, battlePassXp);
                    }
                    if (QuestRepository.Execute(connection, transaction,
                        "UPDATE player_quests SET RewardClaimed=1,RewardClaimedAt=UTC_TIMESTAMP() " +
                        "WHERE Id=@id AND PlayerId=@player AND Completed=1 AND RewardClaimed=0",
                        ("@id", questId), ("@player", character.Id)) != 1)
                    {
                        throw new InvalidOperationException("Concurrent quest reward claim rejected.");
                    }
                    committedItems = TransactionalItemRewards.Insert(character.Id, itemRewards, connection, transaction);
                    return new QuestClaimResult(true, "Récompense récupérée", kamas, xp, battlePassXp);
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

                cached.RewardClaimed = true;
                cached.RewardClaimedAt = DateTime.UtcNow;
                session.BattlePassExperience += result.BattlePassXp;
                character.DisplayNotification(BuildNotification(result, itemRewards));
                QuestStateService.Instance.SendState(character, session, "CLAIM");
                return result;
            }
        }

        private static string BuildNotification(QuestClaimResult result, IReadOnlyList<(int ItemId, int Quantity)> items)
        {
            List<string> parts = new();
            if (result.Kamas > 0) parts.Add($"{result.Kamas:N0} kamas");
            if (result.PlayerXp > 0) parts.Add($"{result.PlayerXp:N0} XP");
            if (result.BattlePassXp > 0) parts.Add($"{result.BattlePassXp:N0} XP Battle Pass");
            if (items.Count > 0) parts.Add($"{items.Sum(x => x.Quantity)} objet(s)");
            return "Récompense récupérée" + (parts.Count > 0 ? " : " + string.Join(", ", parts) : string.Empty);
        }
    }
}
