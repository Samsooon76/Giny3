using Giny.ORM.Attributes;
using Giny.ORM.Interfaces;
using System.Collections.Concurrent;

namespace Giny.GuildCamp.Data.Records
{
    [Table("guild_buildings")]
    public sealed class GuildBuildingRecord : IRecord
    {
        [Container]
        private static readonly ConcurrentDictionary<long, GuildBuildingRecord> Records = new();

        [Primary] public long Id { get; set; }
        [Update] public string Code { get; set; } = string.Empty;
        [Update] public string Name { get; set; } = string.Empty;
        [Update, TypeOverride("TEXT")] public string Description { get; set; } = string.Empty;
        [Update] public short DisplayOrder { get; set; }
        [Update] public short OverlayX { get; set; }
        [Update] public short OverlayY { get; set; }
        [Update] public short OverlayWidth { get; set; }
        [Update] public short OverlayHeight { get; set; }
        [Update] public bool Enabled { get; set; }

        public static GuildBuildingRecord? Get(long id) => Records.TryGetValue(id, out var value) ? value : null;
        public static IEnumerable<GuildBuildingRecord> GetAll() => Records.Values.Where(x => x.Enabled).OrderBy(x => x.DisplayOrder);
    }

    [Table("guild_building_levels")]
    public sealed class GuildBuildingLevelRecord : IRecord
    {
        [Container]
        private static readonly ConcurrentDictionary<long, GuildBuildingLevelRecord> Records = new();

        [Primary] public long Id { get; set; }
        [Update] public long BuildingId { get; set; }
        [Update] public byte Level { get; set; }
        [Update] public long KamaCost { get; set; }
        [Update] public string AssetPath { get; set; } = string.Empty;

        public static GuildBuildingLevelRecord? Get(long buildingId, byte level) =>
            Records.Values.FirstOrDefault(x => x.BuildingId == buildingId && x.Level == level);

        public static IEnumerable<GuildBuildingLevelRecord> GetAll(long buildingId) =>
            Records.Values.Where(x => x.BuildingId == buildingId).OrderBy(x => x.Level);
    }

    [Table("guild_building_effects")]
    public sealed class GuildBuildingEffectRecord : IRecord
    {
        [Container]
        private static readonly ConcurrentDictionary<long, GuildBuildingEffectRecord> Records = new();

        [Primary] public long Id { get; set; }
        [Update] public long BuildingLevelId { get; set; }
        [Update] public string EffectType { get; set; } = string.Empty;
        [Update, TypeOverride("DOUBLE")] public double Value { get; set; }
        [Update] public string Description { get; set; } = string.Empty;
        [Update, TypeOverride("LONGTEXT")] public string Parameters { get; set; } = "{}";

        public static IEnumerable<GuildBuildingEffectRecord> GetAll(long buildingLevelId) =>
            Records.Values.Where(x => x.BuildingLevelId == buildingLevelId).OrderBy(x => x.Id);
    }

    [Table("guild_building_level_requirements")]
    public sealed class GuildBuildingLevelRequirementRecord : IRecord
    {
        [Container]
        private static readonly ConcurrentDictionary<long, GuildBuildingLevelRequirementRecord> Records = new();

        [Primary] public long Id { get; set; }
        [Update] public long BuildingLevelId { get; set; }
        [Update] public int ItemId { get; set; }
        [Update] public int RequiredQuantity { get; set; }

        public static IEnumerable<GuildBuildingLevelRequirementRecord> GetAll(long buildingLevelId) =>
            Records.Values.Where(x => x.BuildingLevelId == buildingLevelId).OrderBy(x => x.Id);
    }
}
