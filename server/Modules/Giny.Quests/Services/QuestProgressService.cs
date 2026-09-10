using Giny.Core.DesignPattern;
using Giny.Protocol.Enums;
using Giny.Quests.Data;
using Giny.Quests.Domain;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Managers.Fights;
using Giny.World.Managers.Fights.Fighters;
using Giny.World.Managers.Fights.Results;

namespace Giny.Quests.Services
{
    internal sealed class QuestProgressService : Singleton<QuestProgressService>
    {
        public void OnFightResult(FightPlayerResult result)
        {
            if (result.Outcome != FightOutcomeEnum.RESULT_VICTORY || result.Fighter.Fight is not FightPvM fight)
            {
                return;
            }

            Character character = result.Character;
            List<QuestGameEvent> events = new()
            {
                QuestGameEvent.Of(QuestObjectiveTypes.WinFights),
            };

            MonsterFighter[] killed = fight.GetFighters<MonsterFighter>(false)
                .Where(x => !x.IsSummoned() && !x.Alive)
                .ToArray();
            if (killed.Length > 0)
            {
                events.Add(QuestGameEvent.Of(QuestObjectiveTypes.KillMonsters, killed.Length));
                events.AddRange(killed.GroupBy(x => (long)x.Record.Race).Select(group => new QuestGameEvent
                {
                    EventType = QuestObjectiveTypes.KillMonsterFamily,
                    FamilyId = group.Key,
                    Amount = group.Count(),
                }));
                events.AddRange(killed.GroupBy(x => x.Record.Id).Select(group => new QuestGameEvent
                {
                    EventType = QuestObjectiveTypes.KillSpecificMonster,
                    EntityId = group.Key,
                    Amount = group.Count(),
                }));
                events.AddRange(killed.Where(x => x.Record.IsBoss).GroupBy(x => x.Record.Id).Select(group => new QuestGameEvent
                {
                    EventType = QuestObjectiveTypes.KillBoss,
                    EntityId = group.Key,
                    Amount = group.Count(),
                }));
            }

            int challenges = fight.Challenges.GetNumberOfChallengesSucceeed();
            if (challenges > 0)
            {
                events.Add(QuestGameEvent.Of(QuestObjectiveTypes.CompleteChallenges, challenges));
            }

            if (fight.Map.IsDungeonMap && fight.Map.Dungeon?.Rooms?.LastOrDefault()?.MapId == fight.Map.Id)
            {
                events.Add(QuestGameEvent.Of(QuestObjectiveTypes.CompleteDungeons));
                events.Add(new QuestGameEvent
                {
                    EventType = QuestObjectiveTypes.CompleteSpecificDungeon,
                    DungeonId = fight.Map.Dungeon.Id,
                });
            }

            if (character.Inventory.GetItems().Any(x => x.Position >= 22 && x.Position <= 24))
            {
                events.Add(QuestGameEvent.Of(QuestObjectiveTypes.FightWithPokefus));
            }
            OnGameEvents(character, events);
        }

        public void OnResourcesHarvested(Character character, int resourceId, int amount) =>
            OnGameEvents(character, new[]
            {
                new QuestGameEvent
                {
                    EventType = QuestObjectiveTypes.HarvestResources,
                    ResourceId = resourceId,
                    Amount = amount,
                },
            });

        public void OnItemsCrafted(Character character, long recipeId, int amount) =>
            OnGameEvents(character, new[]
            {
                new QuestGameEvent
                {
                    EventType = QuestObjectiveTypes.CraftItems,
                    RecipeId = recipeId,
                    Amount = amount,
                },
            });

        public void OnPokefusCaptured(Character character, string rarity) =>
            OnGameEvents(character, new[]
            {
                QuestGameEvent.Of(QuestObjectiveTypes.CapturePokefus),
                new QuestGameEvent
                {
                    EventType = QuestObjectiveTypes.CapturePokefusRarity,
                    Rarity = rarity,
                },
            });

        public bool AddAdminProgress(Character character, long questId, int amount)
        {
            QuestSession session = QuestGenerationService.Instance.EnsurePeriods(character);
            lock (session.SyncRoot)
            {
                PlayerQuest? quest = session.Quests.FirstOrDefault(x => x.Id == questId);
                if (quest == null || amount <= 0)
                {
                    return false;
                }
                ApplyChanges(character, session, new[] { (quest, amount) });
                return true;
            }
        }

        private void OnGameEvents(Character character, IEnumerable<QuestGameEvent> gameEvents)
        {
            QuestSession session = QuestGenerationService.Instance.EnsurePeriods(character);
            lock (session.SyncRoot)
            {
                QuestGameEvent[] events = gameEvents.ToArray();
                List<(PlayerQuest Quest, int Amount)> changes = new();
                foreach (PlayerQuest quest in session.Quests.Where(IsProgressable))
                {
                    int amount = events.Where(x => Matches(quest, x)).Sum(x => x.Amount);
                    if (amount > 0)
                    {
                        changes.Add((quest, amount));
                    }
                }
                ApplyChanges(character, session, changes);
            }
        }

        private static bool IsProgressable(PlayerQuest quest) =>
            !quest.Completed && !quest.RewardClaimed && quest.ExpiresAt > DateTime.UtcNow;

        public static bool Matches(PlayerQuest quest, QuestGameEvent gameEvent)
        {
            if (!string.Equals(quest.ObjectiveType, gameEvent.EventType, StringComparison.Ordinal))
            {
                return false;
            }
            return quest.ObjectiveType switch
            {
                QuestObjectiveTypes.KillMonsterFamily => !quest.TargetFamilyId.HasValue || quest.TargetFamilyId == gameEvent.FamilyId,
                QuestObjectiveTypes.KillSpecificMonster or QuestObjectiveTypes.KillBoss =>
                    !quest.TargetEntityId.HasValue || quest.TargetEntityId == gameEvent.EntityId,
                QuestObjectiveTypes.CompleteSpecificDungeon =>
                    !quest.TargetDungeonId.HasValue || quest.TargetDungeonId == gameEvent.DungeonId,
                QuestObjectiveTypes.HarvestResources =>
                    !quest.TargetResourceId.HasValue || quest.TargetResourceId == gameEvent.ResourceId,
                QuestObjectiveTypes.CraftItems =>
                    !quest.TargetRecipeId.HasValue || quest.TargetRecipeId == gameEvent.RecipeId,
                QuestObjectiveTypes.CapturePokefusRarity =>
                    string.Equals(quest.TargetPokefusRarity, gameEvent.Rarity, StringComparison.OrdinalIgnoreCase),
                _ => true,
            };
        }

        private static void ApplyChanges(
            Character character,
            QuestSession session,
            IReadOnlyList<(PlayerQuest Quest, int Amount)> changes)
        {
            if (changes.Count == 0)
            {
                return;
            }

            Dictionary<long, int> previous = changes.ToDictionary(x => x.Quest.Id, x => x.Quest.CurrentAmount);
            IReadOnlyList<QuestProgressResult> results = QuestGenerationService.Instance.Repository.ApplyProgress(character.Id, changes);
            foreach (QuestProgressResult result in results)
            {
                PlayerQuest? quest = session.Quests.FirstOrDefault(x => x.Id == result.QuestId);
                if (quest == null) continue;
                int oldAmount = previous[result.QuestId];
                quest.CurrentAmount = result.CurrentAmount;
                quest.Completed = result.Completed;
                quest.CompletedAt = result.CompletedAt;

                if (quest.Completed)
                {
                    character.DisplayNotification($"Quête terminée : {quest.Title}");
                }
                else if (CrossedMilestone(oldAmount, quest.CurrentAmount, quest.TargetAmount))
                {
                    character.DisplayNotification($"Quête : {quest.Title} — {quest.CurrentAmount}/{quest.TargetAmount}");
                }
            }
            if (results.Count > 0)
            {
                QuestStateService.Instance.SendState(character, session, "PROGRESS");
            }
        }

        private static bool CrossedMilestone(int before, int after, int target)
        {
            if (target <= 0) return false;
            int beforeQuarter = Math.Min(3, before * 4 / target);
            int afterQuarter = Math.Min(3, after * 4 / target);
            return afterQuarter > beforeQuarter;
        }
    }
}
