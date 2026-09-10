namespace Giny.Quests.Domain
{
    public static class QuestPeriods
    {
        public const string Daily = "DAILY";
        public const string Weekly = "WEEKLY";
    }

    public static class QuestObjectiveTypes
    {
        public const string KillMonsters = "KILL_MONSTERS";
        public const string KillMonsterFamily = "KILL_MONSTER_FAMILY";
        public const string KillSpecificMonster = "KILL_SPECIFIC_MONSTER";
        public const string KillBoss = "KILL_BOSS";
        public const string WinFights = "WIN_FIGHTS";
        public const string CompleteDungeons = "COMPLETE_DUNGEONS";
        public const string CompleteSpecificDungeon = "COMPLETE_SPECIFIC_DUNGEON";
        public const string CapturePokefus = "CAPTURE_POKEFUS";
        public const string CapturePokefusRarity = "CAPTURE_POKEFUS_RARITY";
        public const string FightWithPokefus = "FIGHT_WITH_POKEFUS";
        public const string HarvestResources = "HARVEST_RESOURCES";
        public const string CraftItems = "CRAFT_ITEMS";
        public const string CompleteChallenges = "COMPLETE_CHALLENGES";
        public const string DiscoverZones = "DISCOVER_ZONES";
    }

    public static class QuestRewardTypes
    {
        public const string Kamas = "KAMAS";
        public const string PlayerXp = "PLAYER_XP";
        public const string BattlePassXp = "BATTLE_PASS_XP";
        public const string Item = "ITEM";
    }
}
