using System.Globalization;

namespace Giny.Quests.Domain
{
    public sealed record QuestPeriodWindow(string Period, string Key, DateTimeOffset StartedAt, DateTimeOffset ExpiresAt);

    public sealed class QuestResetSchedule
    {
        public TimeZoneInfo TimeZone { get; init; } = TimeZoneInfo.Local;
        public TimeSpan DailyReset { get; init; } = new(0, 1, 0);
        public DayOfWeek WeeklyResetDay { get; init; } = DayOfWeek.Monday;
        public TimeSpan WeeklyReset { get; init; } = new(1, 0, 0);
    }

    public static class QuestPeriodCalculator
    {
        public static QuestPeriodWindow GetDaily(DateTimeOffset utcNow, QuestResetSchedule schedule)
        {
            DateTime localNow = TimeZoneInfo.ConvertTime(utcNow, schedule.TimeZone).DateTime;
            DateTime reset = localNow.Date.Add(schedule.DailyReset);
            if (localNow < reset)
            {
                reset = reset.AddDays(-1);
            }

            DateTime next = reset.AddDays(1);
            DateTimeOffset startedAt = ToUtc(reset, schedule.TimeZone);
            DateTimeOffset expiresAt = ToUtc(next, schedule.TimeZone);
            return new QuestPeriodWindow(
                QuestPeriods.Daily,
                reset.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                startedAt,
                expiresAt);
        }

        public static QuestPeriodWindow GetWeekly(DateTimeOffset utcNow, QuestResetSchedule schedule)
        {
            DateTime localNow = TimeZoneInfo.ConvertTime(utcNow, schedule.TimeZone).DateTime;
            int daysSinceResetDay = ((int)localNow.DayOfWeek - (int)schedule.WeeklyResetDay + 7) % 7;
            DateTime reset = localNow.Date.AddDays(-daysSinceResetDay).Add(schedule.WeeklyReset);
            if (localNow < reset)
            {
                reset = reset.AddDays(-7);
            }

            DateTime next = reset.AddDays(7);
            int week = ISOWeek.GetWeekOfYear(reset.Date);
            int year = ISOWeek.GetYear(reset.Date);
            return new QuestPeriodWindow(
                QuestPeriods.Weekly,
                $"{year}-W{week:00}",
                ToUtc(reset, schedule.TimeZone),
                ToUtc(next, schedule.TimeZone));
        }

        public static (int Min, int Max) GetLevelBracket(string period, int playerLevel)
        {
            int level = Math.Clamp(playerLevel, 1, 200);
            int size = period == QuestPeriods.Weekly ? 40 : 20;
            int min = ((level - 1) / size) * size + 1;
            return (min, Math.Min(200, min + size - 1));
        }

        private static DateTimeOffset ToUtc(DateTime local, TimeZoneInfo timeZone)
        {
            DateTime unspecified = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
            return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(unspecified, timeZone), TimeSpan.Zero);
        }
    }
}
