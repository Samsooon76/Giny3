using Giny.Core.DesignPattern;
using Giny.Quests.Domain;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Records.Items;
using System.Text.Json;
using Giny.Protocol.Messages;

namespace Giny.Quests.Services
{
    internal sealed class QuestStateService : Singleton<QuestStateService>
    {
        public const string StatePrefix = "[QUEST_STATE]";

        public void SendState(Character character, QuestSession? knownSession = null, string operation = "SYNC")
        {
            QuestSession session = knownSession ?? QuestGenerationService.Instance.EnsurePeriods(character);
            lock (session.SyncRoot)
            {
                DateTimeOffset now = DateTimeOffset.UtcNow;
                object daily = BuildPeriod(session, QuestPeriods.Daily, session.Daily.Key);
                object weekly = BuildPeriod(session, QuestPeriods.Weekly, session.Weekly.Key);
                object[] unclaimed = session.Quests
                    .Where(x => x.Completed && !x.RewardClaimed &&
                                !((x.Period == QuestPeriods.Daily && x.PeriodKey == session.Daily.Key) ||
                                  (x.Period == QuestPeriods.Weekly && x.PeriodKey == session.Weekly.Key)))
                    .OrderByDescending(x => x.CompletedAt)
                    .Select(BuildQuest)
                    .ToArray();

                (int bracketMin, int bracketMax) = QuestPeriodCalculator.GetLevelBracket(QuestPeriods.Daily, character.Level);
                string json = JsonSerializer.Serialize(new
                {
                    operation,
                    serverUnix = now.ToUnixTimeSeconds(),
                    dailyResetUnix = session.Daily.ExpiresAt.ToUnixTimeSeconds(),
                    weeklyResetUnix = session.Weekly.ExpiresAt.ToUnixTimeSeconds(),
                    playerLevel = character.Level,
                    levelBracketMin = bracketMin,
                    levelBracketMax = bracketMax,
                    battlePass = BattlePassTrackService.BuildState(
                        character.Id,
                        session.BattlePassExperience,
                        session.BattlePassVip),
                    daily,
                    weekly,
                    unclaimed,
                });
                character.Reply(StatePrefix + Uri.EscapeDataString(json));
                using var document = JsonDocument.Parse(json);
                character.Client.Send(new ModernModuleStateMessage(JsonSerializer.Serialize(new
                {
                    schemaVersion = 1, characterId = character.Id.ToString(), module = "quests", state = document.RootElement,
                })));
            }
        }

        private static object BuildPeriod(QuestSession session, string period, string key)
        {
            PlayerQuest[] quests = session.Quests
                .Where(x => x.Period == period && x.PeriodKey == key)
                .OrderBy(x => x.SlotNumber)
                .ToArray();
            return new
            {
                periodKey = key,
                completed = quests.Count(x => x.Completed),
                total = quests.Length,
                quests = quests.Select(BuildQuest).ToArray(),
            };
        }

        private static object BuildQuest(PlayerQuest quest) => new
        {
            id = quest.Id,
            period = quest.Period,
            periodKey = quest.PeriodKey,
            category = quest.Category,
            objectiveType = quest.ObjectiveType,
            title = quest.Title,
            description = quest.Description,
            currentAmount = quest.CurrentAmount,
            targetAmount = quest.TargetAmount,
            completed = quest.Completed,
            rewardClaimed = quest.RewardClaimed,
            expiresUnix = new DateTimeOffset(DateTime.SpecifyKind(quest.ExpiresAt, DateTimeKind.Utc)).ToUnixTimeSeconds(),
            rewards = quest.Rewards.Select(x => new
            {
                type = x.RewardType,
                amount = x.Amount,
                itemId = x.ItemId,
                label = RewardLabel(x),
            }).ToArray(),
        };

        private static string RewardLabel(PlayerQuestReward reward) => reward.RewardType switch
        {
            QuestRewardTypes.Kamas => $"{reward.Amount:N0} kamas",
            QuestRewardTypes.PlayerXp => $"{reward.Amount:N0} XP",
            QuestRewardTypes.BattlePassXp => $"{reward.Amount:N0} XP Battle Pass",
            QuestRewardTypes.Item when reward.ItemId.HasValue =>
                $"{reward.Amount:N0} × {ItemRecord.GetItem(reward.ItemId.Value)?.Name ?? $"objet #{reward.ItemId.Value}"}",
            _ => $"{reward.Amount:N0} {reward.RewardType}",
        };
    }
}
