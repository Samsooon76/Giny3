namespace Giny.Quests.Domain
{
    public static class BattlePassTracks
    {
        public const string Free = "FREE";
        public const string Vip = "VIP";
    }

    public static class BattlePassRules
    {
        public static int CurrentLevel(long experience, int experiencePerLevel)
        {
            int perLevel = Math.Max(1, experiencePerLevel);
            return checked((int)(experience / perLevel)) + 1;
        }

        public static int UnlockedLevels(long experience, int experiencePerLevel)
        {
            int perLevel = Math.Max(1, experiencePerLevel);
            return checked((int)(experience / perLevel));
        }

        public static long ProgressInLevel(long experience, int experiencePerLevel)
        {
            int perLevel = Math.Max(1, experiencePerLevel);
            return experience % perLevel;
        }

        public static int WindowStart(int unlockedLevels, int levelCount, int windowSize = 8)
        {
            int count = Math.Max(1, levelCount);
            int size = Math.Max(1, Math.Min(windowSize, count));
            int preferred = Math.Max(1, unlockedLevels);
            return Math.Min(preferred, count - size + 1);
        }

        public static bool CanClaim(int unlockedLevels, int level, string track, bool vip, bool claimed)
        {
            if (claimed || level <= 0 || unlockedLevels < level)
            {
                return false;
            }

            return !string.Equals(track, BattlePassTracks.Vip, StringComparison.OrdinalIgnoreCase) || vip;
        }
    }
}
