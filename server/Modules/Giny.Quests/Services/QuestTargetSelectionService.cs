using Giny.Quests.Data;
using Giny.Quests.Data.Records;
using Giny.Quests.Domain;
using Giny.World.Records.Maps;
using Giny.World.Records.Monsters;

namespace Giny.Quests.Services
{
    internal sealed class QuestTargetSelectionService
    {
        public QuestDraft? Resolve(
            QuestTemplateRecord template,
            int minLevel,
            int maxLevel,
            DeterministicQuestRandom random)
        {
            long? entityId = template.TargetEntityId;
            long? familyId = template.TargetFamilyId;
            long? dungeonId = template.TargetDungeonId;
            string targetName = string.Empty;

            switch (template.ObjectiveType)
            {
                case QuestObjectiveTypes.KillMonsterFamily:
                {
                    MonsterRecord[] monsters = EligibleMonsters(minLevel, maxLevel)
                        .Where(x => !x.IsBoss && (int)x.Race > 0)
                        .ToArray();
                    var families = monsters.GroupBy(x => (long)x.Race)
                        .Where(x => x.Count() >= 2)
                        .OrderBy(x => x.Key)
                        .ToArray();
                    if (families.Length == 0) return null;
                    var family = families[random.Next(families.Length)];
                    familyId = family.Key;
                    targetName = family.OrderBy(x => x.Id).First().Name;
                    break;
                }
                case QuestObjectiveTypes.KillSpecificMonster:
                {
                    MonsterRecord[] monsters = EligibleMonsters(minLevel, maxLevel)
                        .Where(x => !x.IsBoss && !x.IsMiniBoss && !x.IsQuestMonster)
                        .OrderBy(x => x.Id)
                        .ToArray();
                    if (monsters.Length == 0) return null;
                    MonsterRecord monster = monsters[random.Next(monsters.Length)];
                    entityId = monster.Id;
                    targetName = monster.Name;
                    break;
                }
                case QuestObjectiveTypes.KillBoss:
                {
                    MonsterRecord[] bosses = EligibleMonsters(minLevel, maxLevel)
                        .Where(x => x.IsBoss)
                        .OrderBy(x => x.Id)
                        .ToArray();
                    if (bosses.Length == 0) return null;
                    MonsterRecord boss = bosses[random.Next(bosses.Length)];
                    entityId = boss.Id;
                    targetName = boss.Name;
                    break;
                }
                case QuestObjectiveTypes.CompleteSpecificDungeon:
                {
                    DungeonRecord[] dungeons = DungeonRecord.GetDungeonRecords()
                        .Where(x => x.OptimalPlayerLevel >= minLevel && x.OptimalPlayerLevel <= maxLevel)
                        .OrderBy(x => x.Id)
                        .ToArray();
                    if (dungeons.Length == 0)
                    {
                        dungeons = DungeonRecord.GetDungeonRecords()
                            .Where(x => Math.Abs(x.OptimalPlayerLevel - ((minLevel + maxLevel) / 2)) <= 20)
                            .OrderBy(x => x.Id)
                            .ToArray();
                    }
                    if (dungeons.Length == 0) return null;
                    DungeonRecord dungeon = dungeons[random.Next(dungeons.Length)];
                    dungeonId = dungeon.Id;
                    targetName = dungeon.Name;
                    break;
                }
                default:
                    targetName = ResolveFixedTargetName(template) ?? string.Empty;
                    break;
            }

            string amount = template.TargetAmount.ToString();
            string titleTarget = targetName;
            string descriptionTarget = template.ObjectiveType == QuestObjectiveTypes.CompleteSpecificDungeon
                ? WithFrenchArticle(targetName)
                : targetName;
            string title = template.Name.Replace("{amount}", amount).Replace("{target}", titleTarget);
            string description = template.DescriptionTemplate
                .Replace("{amount}", amount)
                .Replace("{target}", descriptionTarget);
            return new QuestDraft(template, title, description, entityId, familyId, dungeonId);
        }

        private static IEnumerable<MonsterRecord> EligibleMonsters(int minLevel, int maxLevel) =>
            MonsterRecord.GetMonsterRecords().Where(x =>
                x.Grades != null && x.Grades.Any(g => g.Level >= minLevel && g.Level <= maxLevel));

        private static string? ResolveFixedTargetName(QuestTemplateRecord template)
        {
            if (template.TargetEntityId is > 0 and <= short.MaxValue)
            {
                return MonsterRecord.GetMonsterRecord((short)template.TargetEntityId.Value)?.Name;
            }
            if (template.TargetDungeonId.HasValue)
            {
                return DungeonRecord.GetDungeonRecords().FirstOrDefault(x => x.Id == template.TargetDungeonId)?.Name;
            }
            return null;
        }

        private static string WithFrenchArticle(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return name;
            }

            string trimmed = name.Trim();
            string lower = trimmed.ToLowerInvariant();
            if (lower.StartsWith("le ") || lower.StartsWith("la ") || lower.StartsWith("les ") ||
                lower.StartsWith("l'") || lower.StartsWith("l’"))
            {
                return trimmed;
            }

            return "le " + trimmed;
        }
    }
}
