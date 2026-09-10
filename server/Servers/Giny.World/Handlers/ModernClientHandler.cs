using System.Linq;
using Giny.World.Managers.Entities.Npcs;
using System.Text.Json;
using Giny.Core.Network.Messages;
using Giny.Protocol.Messages;
using Giny.World.Managers.Entities.Look;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Managers.Maps.Elements;
using Giny.World.Managers.Modern;
using Giny.World.Network;
using Giny.World.Managers.Monsters;
using Giny.World.Records.Monsters;

namespace Giny.World.Handlers
{
    /// <summary>Protocol projection dedicated to the modern web client.</summary>
    internal static class ModernClientHandler
    {
        [MessageHandler]
        public static void HandleModernCharacterSnapshotRequestMessage(
            ModernCharacterSnapshotRequestMessage message,
            WorldClient client)
        {
            client.ModernClientEnabled = true;
            if (client.Character == null)
            {
                client.Send(new ModernCharacterSnapshotMessage("{\"error\":\"no_character\"}"));
                return;
            }

            ModernCharacterSnapshot.Send(client, force: false);
        }

        [MessageHandler]
        public static void HandleModernMapSnapshotRequestMessage(
            ModernMapSnapshotRequestMessage message,
            WorldClient client)
        {
            client.ModernClientEnabled = true;
            var character = client.Character;
            var map = character?.Map;
            if (character == null || map?.Instance == null)
            {
                client.Send(new ModernMapSnapshotMessage("{\"error\":\"no_active_map\"}"));
                return;
            }

            var actors = map.Instance.GetEntities()
                .OrderBy(entity => entity.Id)
                .Select(entity => new
                {
                    id = entity.Id,
                    kind = entity.GetType().Name,
                    name = entity.Name,
                    cell_id = entity.CellId,
                    direction = (byte)entity.Direction,
                    entity_look = EntityLookManager.Instance.ConvertToString(entity.Look),
                    is_local_player = entity.Id == character.Id,
                    npc = entity is Npc npc ? ModernNpcInteractions.ProjectActor(npc, character) : null,
                    guild = entity is Character player && player.HasGuild ? new
                    {
                        id = player.Guild.Id,
                        name = player.Guild.Record.Name,
                        emblem = new
                        {
                            symbol_shape = player.Guild.Record.Emblem.SymbolShape,
                            symbol_color = player.Guild.Record.Emblem.SymbolColor,
                            background_shape = player.Guild.Record.Emblem.BackgroundShape,
                            background_color = player.Guild.Record.Emblem.BackgroundColor,
                        },
                    } : null,
                    group = entity is MonsterGroup group ? ProjectMonsterGroup(group) : null,
                })
                .ToArray();

            /*
             * Les elements interactifs de la carte, tels que le client doit les voir :
             * l'identifiant est celui du m_interactionId cote client, `gfx_id` designe un
             * sprite mapgfx et `bones_id` un prop Animator2D (l'un des deux vaut -1).
             * `state` n'est renseigne que pour les elements a etats (ressources).
             */
            var interactives = map.Instance.GetElements<MapInteractiveElement>()
                .OrderBy(element => element.Record.Identifier)
                .Select(element =>
                {
                    var skill = element.Record.Skill;
                    var stated = element as MapStatedElement;

                    return new
                    {
                        element_id = element.Record.Identifier,
                        cell_id = element.Record.CellId,
                        gfx_id = element.Record.GfxId,
                        bones_id = element.Record.BonesId,
                        element_type_id = (int)skill.Type,
                        skill_id = (int)skill.SkillId,
                        skill_name = skill.Record?.Name,
                        action = skill.ActionIdentifier.ToString(),
                        enabled = element.IsEnabledFor(character),
                        state = stated != null ? (int?)stated.CurrentState : null,
                        job_id = (int?)skill.Record?.ParentJobId,
                        min_level = (int?)skill.Record?.MinLevel,
                    };
                })
                .ToArray();

            var snapshot = JsonSerializer.Serialize(new
            {
                map_id = map.Id,
                subarea_id = map.SubareaId,
                local_character_id = character.Id,
                actors,
                interactives,
            });
            client.Send(new ModernMapSnapshotMessage(snapshot));
        }

        static object ProjectMonsterGroup(MonsterGroup group)
        {
            var monsters = group.GetMonsters().ToArray();
            return new
            {
                attackable = group.CanBeAggressed,
                members = monsters.Select(m => new
                {
                    id = m.Record.Id,
                    name = m.Record.Name,
                    level = m.Grade?.Level ?? 0,
                    grade = m.GradeId,
                    look = EntityLookManager.Instance.ConvertToString(m.Look),
                    is_boss = m.Record.IsBoss,
                    is_mini_boss = m.Record.IsMiniBoss,
                }).ToArray(),
                modular = group is Giny.World.Managers.Entities.Monsters.ModularMonsterGroup,
                xp = monsters.Sum(m => m.Grade?.GradeXp ?? 0),
                kamas = monsters.Sum(m => AverageDroppedKamas(m)),
                drops = monsters
                    .SelectMany(m => (m.Record.Drops ?? new List<MonsterDrop>())
                        .Where(drop => drop.ItemGId > 0 && drop.GetDropRate(m.GradeId) > 0)
                        .Select(drop => drop.ItemGId))
                    .Distinct()
                    .ToArray(),
            };
        }

        static int AverageDroppedKamas(Monster monster)
        {
            var min = monster.Record.MinDroppedKamas;
            var max = monster.Record.MaxDroppedKamas;
            if (max < min)
            {
                max = min;
            }
            if (min == 0 && max == 0)
            {
                return Math.Max(1, (int)(monster.Grade?.Level ?? 1));
            }
            return (min + max) / 2;
        }
    }
}
