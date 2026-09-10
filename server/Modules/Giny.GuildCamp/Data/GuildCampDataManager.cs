using Giny.Core;
using Giny.GuildCamp.Data.Records;
using Giny.ORM;
using System.Reflection;

namespace Giny.GuildCamp.Data
{
    internal static class GuildCampDataManager
    {
        private const string MigrationSuffix = "002_guild_camp.sql";

        private static readonly Type[] RecordTypes =
        {
            typeof(GuildBuildingRecord),
            typeof(GuildBuildingLevelRecord),
            typeof(GuildBuildingEffectRecord),
            typeof(GuildBuildingLevelRequirementRecord),
        };

        public static void Initialize()
        {
            ApplyMigration();
            DatabaseManager.Instance.RegisterTables(RecordTypes);
            Validate();
            Logger.Write($"Guild camp loaded: {GuildBuildingRecord.GetAll().Count()} buildings.", Channels.Info);
        }

        private static void Validate()
        {
            foreach (GuildBuildingRecord building in GuildBuildingRecord.GetAll())
            {
                GuildBuildingLevelRecord[] levels = GuildBuildingLevelRecord.GetAll(building.Id).ToArray();
                if (levels.Length == 0 || levels[0].Level != 1)
                {
                    throw new InvalidDataException($"Guild building {building.Code} has no level 1.");
                }

                for (int index = 0; index < levels.Length; index++)
                {
                    if (levels[index].Level != index + 1 || string.IsNullOrWhiteSpace(levels[index].AssetPath))
                    {
                        throw new InvalidDataException($"Guild building {building.Code} levels are not contiguous or have no asset.");
                    }
                }
            }
        }

        private static void ApplyMigration()
        {
            Assembly assembly = typeof(GuildCampDataManager).Assembly;
            string? name = assembly.GetManifestResourceNames()
                .SingleOrDefault(x => x.EndsWith(MigrationSuffix, StringComparison.Ordinal));
            if (name == null)
            {
                throw new InvalidDataException($"Embedded guild camp migration '{MigrationSuffix}' not found.");
            }

            using Stream stream = assembly.GetManifestResourceStream(name)
                ?? throw new InvalidDataException($"Unable to open guild camp migration '{name}'.");
            using StreamReader reader = new(stream);
            DatabaseManager.Instance.ExecuteScript(reader.ReadToEnd());
        }
    }
}
