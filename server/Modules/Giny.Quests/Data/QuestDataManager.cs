using Giny.Core;
using Giny.ORM;
using Giny.Quests.Data.Records;
using System.Reflection;

namespace Giny.Quests.Data
{
    internal static class QuestDataManager
    {
        private static readonly string[] MigrationSuffixes =
        {
            "003_daily_weekly_quests.sql",
            "004_battle_pass_track.sql",
            "005_clean_quest_amounts.sql",
            "006_quest_copy_polish.sql",
            "007_dungeon_quest_titles.sql",
            "008_battle_pass_icon_items.sql",
        };

        private static readonly Type[] RecordTypes =
        {
            typeof(QuestTemplateRecord),
            typeof(QuestRewardRecord),
        };

        public static void Initialize()
        {
            ApplyMigration();
            DatabaseManager.Instance.RegisterTables(RecordTypes);
            Validate();
            Logger.Write(
                $"Daily/weekly quests loaded: {QuestTemplateRecord.GetAll().Count()} templates, " +
                $"{QuestRewardRecord.GetAll().Count()} rewards.",
                Channels.Info);
        }

        public static void Reload()
        {
            DatabaseManager.Instance.Reload<QuestRewardRecord>();
            DatabaseManager.Instance.Reload<QuestTemplateRecord>();
            Validate();
        }

        private static void Validate()
        {
            foreach (QuestTemplateRecord template in QuestTemplateRecord.GetAll())
            {
                if (string.IsNullOrWhiteSpace(template.Code) || template.TargetAmount <= 0 || template.Weight <= 0)
                {
                    throw new InvalidDataException($"Invalid recurring quest template #{template.Id} ({template.Code}).");
                }

                if (QuestRewardRecord.GetForTemplate(template.Id).Count == 0)
                {
                    throw new InvalidDataException($"Recurring quest template {template.Code} has no reward.");
                }
            }
        }

        private static void ApplyMigration()
        {
            Assembly assembly = typeof(QuestDataManager).Assembly;
            foreach (string suffix in MigrationSuffixes)
            {
                string? name = assembly.GetManifestResourceNames()
                    .SingleOrDefault(x => x.EndsWith(suffix, StringComparison.Ordinal));
                if (name == null)
                {
                    throw new InvalidDataException($"Embedded quest migration '{suffix}' not found.");
                }

                using Stream stream = assembly.GetManifestResourceStream(name)
                    ?? throw new InvalidDataException($"Unable to open quest migration '{name}'.");
                using StreamReader reader = new(stream);
                DatabaseManager.Instance.ExecuteScript(reader.ReadToEnd());
            }
        }
    }
}
