using Giny.ORM.Attributes;
using Giny.ORM.Interfaces;
using System.Collections.Concurrent;

namespace Giny.Quests.Data.Records
{
    [Table("quest_templates")]
    public sealed class QuestTemplateRecord : IRecord
    {
        [Container]
        private static readonly ConcurrentDictionary<long, QuestTemplateRecord> Records = new();

        [Primary] public long Id { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        [TypeOverride("LONGTEXT")] public string DescriptionTemplate { get; set; } = string.Empty;
        public string QuestPeriod { get; set; } = string.Empty;
        public string ObjectiveType { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public int MinPlayerLevel { get; set; }
        public int MaxPlayerLevel { get; set; }
        public int TargetAmount { get; set; }
        public long? TargetEntityId { get; set; }
        public long? TargetFamilyId { get; set; }
        public long? TargetZoneId { get; set; }
        public long? TargetDungeonId { get; set; }
        public long? TargetResourceId { get; set; }
        public long? TargetRecipeId { get; set; }
        public string? TargetPokefusRarity { get; set; }
        [TypeOverride("LONGTEXT")] public string Parameters { get; set; } = "{}";
        public int Weight { get; set; }
        public bool Enabled { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public static IReadOnlyList<QuestTemplateRecord> GetEligible(string period, int minLevel, int maxLevel) =>
            Records.Values
                .Where(x => x.Enabled && x.QuestPeriod == period &&
                            x.MinPlayerLevel == minLevel && x.MaxPlayerLevel == maxLevel)
                .OrderBy(x => x.Id)
                .ToArray();

        public static QuestTemplateRecord? Get(long id) => Records.TryGetValue(id, out var value) ? value : null;
        public static IEnumerable<QuestTemplateRecord> GetAll() => Records.Values;
    }

    [Table("quest_rewards")]
    public sealed class QuestRewardRecord : IRecord
    {
        [Container]
        private static readonly ConcurrentDictionary<long, QuestRewardRecord> Records = new();

        [Primary] public long Id { get; set; }
        public long TemplateId { get; set; }
        public string RewardType { get; set; } = string.Empty;
        public long Amount { get; set; }
        public int? ItemId { get; set; }
        [TypeOverride("LONGTEXT")] public string Parameters { get; set; } = "{}";
        public int DisplayOrder { get; set; }
        public bool Enabled { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public static IReadOnlyList<QuestRewardRecord> GetForTemplate(long templateId) =>
            Records.Values
                .Where(x => x.Enabled && x.TemplateId == templateId)
                .OrderBy(x => x.DisplayOrder)
                .ThenBy(x => x.Id)
                .ToArray();

        public static IEnumerable<QuestRewardRecord> GetAll() => Records.Values;
    }
}
