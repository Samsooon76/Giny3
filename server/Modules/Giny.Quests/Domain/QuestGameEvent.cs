namespace Giny.Quests.Domain
{
    public sealed class QuestGameEvent
    {
        public string EventType { get; init; } = string.Empty;
        public int Amount { get; init; } = 1;
        public long? EntityId { get; init; }
        public long? FamilyId { get; init; }
        public long? DungeonId { get; init; }
        public long? ResourceId { get; init; }
        public long? RecipeId { get; init; }
        public string? Rarity { get; init; }

        public static QuestGameEvent Of(string eventType, int amount = 1) =>
            new() { EventType = eventType, Amount = amount };
    }
}
