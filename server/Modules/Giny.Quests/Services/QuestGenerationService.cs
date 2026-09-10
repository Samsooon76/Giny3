using Giny.Core;
using Giny.Core.DesignPattern;
using Giny.Core.IO.Configuration;
using Giny.Quests.Data;
using Giny.Quests.Data.Records;
using Giny.Quests.Domain;
using Giny.World;
using Giny.World.Managers.Entities.Characters;
using System.Collections.Concurrent;

namespace Giny.Quests.Services
{
    internal sealed class QuestSession
    {
        public object SyncRoot { get; } = new();
        public QuestPeriodWindow Daily { get; set; } = null!;
        public QuestPeriodWindow Weekly { get; set; } = null!;
        public List<PlayerQuest> Quests { get; set; } = new();
        public long BattlePassExperience { get; set; }
        public bool BattlePassVip { get; set; }
    }

    internal sealed class QuestGenerationService : Singleton<QuestGenerationService>
    {
        private readonly QuestRepository repository = new();
        private readonly QuestTargetSelectionService targets = new();
        private readonly ConcurrentDictionary<long, QuestSession> sessions = new();

        internal QuestRepository Repository => repository;

        public QuestSession EnsurePeriods(Character character, DateTimeOffset? now = null)
        {
            return EnsurePeriods(character, now, out _);
        }

        public QuestSession EnsurePeriods(Character character, DateTimeOffset? now, out bool periodChanged)
        {
            DateTimeOffset instant = now ?? DateTimeOffset.UtcNow;
            QuestResetSchedule schedule = GetSchedule();
            QuestPeriodWindow daily = QuestPeriodCalculator.GetDaily(instant, schedule);
            QuestPeriodWindow weekly = QuestPeriodCalculator.GetWeekly(instant, schedule);
            QuestSession session = sessions.GetOrAdd(character.Id, _ => new QuestSession());

            lock (session.SyncRoot)
            {
                periodChanged = session.Daily == null || session.Weekly == null ||
                                session.Daily.Key != daily.Key || session.Weekly.Key != weekly.Key;
                if (periodChanged || session.Quests.Count == 0)
                {
                    GenerateMissing(character, daily);
                    GenerateMissing(character, weekly);
                    session.Daily = daily;
                    session.Weekly = weekly;
                    session.Quests = repository.LoadForSession(character.Id, daily.Key, weekly.Key).ToList();
                    (session.BattlePassExperience, session.BattlePassVip) = repository.GetBattlePassProgress(character.Id);
                }
                return session;
            }
        }

        public QuestSession Reload(Character character, DateTimeOffset? now = null)
        {
            sessions.TryRemove(character.Id, out _);
            return EnsurePeriods(character, now);
        }

        public void ForceReset(Character character, string period)
        {
            QuestResetSchedule schedule = GetSchedule();
            QuestPeriodWindow window = period == QuestPeriods.Weekly
                ? QuestPeriodCalculator.GetWeekly(DateTimeOffset.UtcNow, schedule)
                : QuestPeriodCalculator.GetDaily(DateTimeOffset.UtcNow, schedule);
            repository.DeletePeriod(character.Id, window);
            Reload(character);
        }

        public void RemoveSession(long playerId) => sessions.TryRemove(playerId, out _);

        public QuestResetSchedule GetSchedule()
        {
            WorldConfig config = ConfigManager<WorldConfig>.Instance;
            TimeZoneInfo timeZone = TimeZoneInfo.Local;
            if (!string.IsNullOrWhiteSpace(config.QuestResetTimeZoneId))
            {
                try
                {
                    timeZone = TimeZoneInfo.FindSystemTimeZoneById(config.QuestResetTimeZoneId);
                }
                catch (Exception exception) when (exception is TimeZoneNotFoundException or InvalidTimeZoneException)
                {
                    Logger.Write($"Unknown quest reset time zone '{config.QuestResetTimeZoneId}', using server local time.", Channels.Warning);
                }
            }
            return new QuestResetSchedule
            {
                TimeZone = timeZone,
                DailyReset = new TimeSpan(Math.Clamp(config.DailyQuestResetHour, 0, 23), Math.Clamp(config.DailyQuestResetMinute, 0, 59), 0),
                WeeklyResetDay = config.WeeklyQuestResetDay,
                WeeklyReset = new TimeSpan(Math.Clamp(config.WeeklyQuestResetHour, 0, 23), Math.Clamp(config.WeeklyQuestResetMinute, 0, 59), 0),
            };
        }

        private void GenerateMissing(Character character, QuestPeriodWindow window)
        {
            if (repository.GetGeneratedCount(character.Id, window) >= 3)
            {
                return;
            }

            (int min, int max) = QuestPeriodCalculator.GetLevelBracket(window.Period, character.Level);
            IReadOnlyList<QuestTemplateRecord> eligible = QuestTemplateRecord.GetEligible(window.Period, min, max);
            DeterministicQuestRandom random = new($"{character.Id}|{window.Period}|{window.Key}");
            IReadOnlyList<QuestTemplateRecord> ordered = QuestTemplateSelector.OrderDiverse(
                eligible,
                x => x.Weight,
                x => x.Category,
                x => x.ObjectiveType,
                random);

            List<QuestDraft> drafts = new();
            foreach (QuestTemplateRecord template in ordered)
            {
                QuestDraft? draft = targets.Resolve(template, min, max, random);
                if (draft != null)
                {
                    drafts.Add(draft);
                }
            }

            if (drafts.Count < 3)
            {
                throw new InvalidDataException(
                    $"Quest pool {window.Period} {min}-{max} has only {drafts.Count} usable templates.");
            }
            repository.InsertGenerated(character.Id, window, drafts);
        }
    }
}
