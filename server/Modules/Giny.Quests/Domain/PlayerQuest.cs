namespace Giny.Quests.Domain
{
    public sealed class PlayerQuest
    {
        public long Id { get; set; }
        public long PlayerId { get; set; }
        public long TemplateId { get; set; }
        public string Period { get; set; } = string.Empty;
        public string PeriodKey { get; set; } = string.Empty;
        public string ObjectiveType { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int TargetAmount { get; set; }
        public int CurrentAmount { get; set; }
        public long? TargetEntityId { get; set; }
        public long? TargetFamilyId { get; set; }
        public long? TargetZoneId { get; set; }
        public long? TargetDungeonId { get; set; }
        public long? TargetResourceId { get; set; }
        public long? TargetRecipeId { get; set; }
        public string? TargetPokefusRarity { get; set; }
        public string Parameters { get; set; } = "{}";
        public bool Completed { get; set; }
        public DateTime? CompletedAt { get; set; }
        public bool RewardClaimed { get; set; }
        public DateTime? RewardClaimedAt { get; set; }
        public DateTime GeneratedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
        public int SlotNumber { get; set; }
        public List<PlayerQuestReward> Rewards { get; } = new();
    }

    public sealed class PlayerQuestReward
    {
        public long Id { get; set; }
        public long PlayerQuestId { get; set; }
        public string RewardType { get; set; } = string.Empty;
        public long Amount { get; set; }
        public int? ItemId { get; set; }
        public string Parameters { get; set; } = "{}";
        public int DisplayOrder { get; set; }
    }
}
