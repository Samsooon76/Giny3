using System;
using System.Linq;
using System.Text.Json;
using Giny.Core;
using Giny.Protocol.Custom.Enums;
using Giny.Protocol.Messages;
using Giny.World.Managers.Bidshops;
using Giny.World.Managers.Criterias;
using Giny.World.Managers.Effects;
using Giny.World.Managers.Entities.Look;
using Giny.World.Managers.Shortcuts;
using Giny.World.Managers.Items;
using Giny.World.Managers.Stats;
using Giny.World.Network;
using Giny.World.Records.Items;
using Giny.World.Records.Spells;
using Giny.World.Records.Characters;
using Giny.World.Records.Tinsel;
using Giny.World.Managers.Experiences;

namespace Giny.World.Managers.Modern
{
    /// <summary>
    /// JSON HUD projection for the web client. Mirrors
    /// <c>ModernMapSnapshot</c>: the payload is a view of live World state.
    /// </summary>
    public static class ModernCharacterSnapshot
    {
        public static void Send(WorldClient client, bool force = true)
        {
            if (client?.Character == null)
            {
                return;
            }

            try
            {
                client.SendCharacterSnapshot(() => BuildJson(client), force);
            }
            catch (Exception exception)
            {
                Logger.Write($"(World) Unable to build modern character snapshot: {exception}", Channels.Warning);
                client.Send(new ModernCharacterSnapshotMessage("{\"error\":\"snapshot_failed\"}"));
            }
        }

        public static string BuildJson(WorldClient client)
        {
            var character = client.Character;
            // During a fight, AP/MP, shields, buffs and current life live on
            // the fighter projection. Outside combat the persistent character
            // stats remain authoritative.
            var stats = character.Fighter?.Stats ?? character.Stats;
            var map = character.Map;
            var account = client.Account;
            var guild = character.HasGuild ? character.Guild : null;

            var vitality = Pack(stats, CharacteristicEnum.VITALITY);
            var strength = Pack(stats, CharacteristicEnum.STRENGTH);
            var intelligence = Pack(stats, CharacteristicEnum.INTELLIGENCE);
            var chance = Pack(stats, CharacteristicEnum.CHANCE);
            var agility = Pack(stats, CharacteristicEnum.AGILITY);
            var wisdom = Pack(stats, CharacteristicEnum.WISDOM);

            var snapshot = new
            {
                catalog_version = Catalog.RuntimeCatalog.Version,
                capabilities = new[] { "item.equip", "item.use", "stats.boost", "stats.reset", "spell.activate", "title.select", "ornament.select" }.Concat(ModernNpcInteractions.Capabilities).Concat(ModernModuleActions.Capabilities).ToArray(),
                titles = new { known = character.Record.KnownTitles, entries = character.Record.KnownTitles.Select(id => new { id, name = TitleRecord.Get(id)?.Name ?? $"Titre {id}" }).ToArray(), active = character.Record.ActiveTitleId },
                ornaments = new { known = character.Record.KnownOrnaments, entries = character.Record.KnownOrnaments.Select(id => new { id, name = OrnamentRecord.Get(id)?.Name ?? $"Ornement {id}" }).ToArray(), active = character.Record.ActiveOrnamentId },
                account = new
                {
                    id = account?.Id ?? 0,
                    username = account?.Username ?? "",
                    nickname = account?.Nickname ?? account?.Username ?? "",
                },
                character = new
                {
                    id = character.Id,
                    name = character.Name,
                    level = character.Level,
                    look = EntityLookManager.Instance.ConvertToString(character.Look),
                    breed_id = character.Record.BreedId,
                    breed_name = character.Breed?.Name ?? $"Classe {character.Record.BreedId}",
                    sex = character.Record.Sex,
                },
                map = new
                {
                    id = map?.Id ?? 0,
                    world_map_id = map?.Subarea?.Area?.WorldMapId ?? 1,
                    subarea_id = map?.SubareaId ?? 0,
                    subarea_name = map?.Subarea?.Name ?? "",
                    area_name = map?.Subarea?.Area?.Name ?? "",
                    x = map?.Position?.X ?? 0,
                    y = map?.Position?.Y ?? 0,
                    level = (int)(map?.Subarea?.Level ?? 0),
                },
                life = new
                {
                    current = stats.LifePoints,
                    max = stats.MaxLifePoints,
                    shield = stats[CharacteristicEnum.SHIELD].TotalInContext(),
                },
                energy = new
                {
                    current = (int)stats.Energy,
                    max = (int)stats.MaxEnergyPoints,
                },
                experience = new
                {
                    current = character.Experience,
                    floor = character.LowerBoundExperience,
                    next = character.UpperBoundExperience,
                },
                points = new
                {
                    stats = TotalOf(stats, CharacteristicEnum.STATS_POINTS),
                    spells = TotalOf(stats, CharacteristicEnum.SPELLS_POINTS),
                    ap = stats.ActionPoints.TotalInContext(),
                    mp = stats.MovementPoints.TotalInContext(),
                    range = stats.Range.TotalInContext(),
                    // InitiativeCharacteristic deliberately rejects
                    // TotalInContext(); its Total() already includes current
                    // life and the bound stat aggregate.
                    initiative = TotalOf(stats, CharacteristicEnum.INITIATIVE),
                    prospecting = stats[CharacteristicEnum.MAGIC_FIND].TotalInContext(),
                    summons = stats[CharacteristicEnum.MAX_SUMMONED_CREATURES_BOOST].TotalInContext(),
                },
                kamas = character.Record.Kamas,
                weight = new
                {
                    current = character.Inventory.CurrentWeight,
                    max = character.Inventory.TotalWeight,
                },
                characteristics = new
                {
                    vitality,
                    strength,
                    intelligence,
                    chance,
                    agility,
                    wisdom,
                },
                combat = new
                {
                    critical_hit = Pack(stats, CharacteristicEnum.CRITICAL_HIT),
                    heal = Pack(stats, CharacteristicEnum.HEAL_BONUS),
                    all_damage = Pack(stats, CharacteristicEnum.ALL_DAMAGE_BONUS),
                    earth_resist = Pack(stats, CharacteristicEnum.EARTH_ELEMENT_RESIST_PERCENT),
                    fire_resist = Pack(stats, CharacteristicEnum.FIRE_ELEMENT_RESIST_PERCENT),
                    water_resist = Pack(stats, CharacteristicEnum.WATER_ELEMENT_RESIST_PERCENT),
                    air_resist = Pack(stats, CharacteristicEnum.AIR_ELEMENT_RESIST_PERCENT),
                    neutral_resist = Pack(stats, CharacteristicEnum.NEUTRAL_ELEMENT_RESIST_PERCENT),
                },
                secondary = new[]
                {
                    Named("power", "Puissance", stats, CharacteristicEnum.DAMAGE_PERCENT),
                    Named("weapon_power", "Puissance armes", stats, CharacteristicEnum.WEAPON_POWER),
                    Named("spell_power", "Puissance sorts", stats, CharacteristicEnum.DAMAGE_PERCENT_SPELL),
                    Named("ap_dodge", "Esquive PA", stats, CharacteristicEnum.DODGE_AP_LOST_PROBABILITY),
                    Named("mp_dodge", "Esquive PM", stats, CharacteristicEnum.DODGE_MP_LOST_PROBABILITY),
                    Named("ap_reduction", "Retrait PA", stats, CharacteristicEnum.AP_REDUCTION),
                    Named("mp_reduction", "Retrait PM", stats, CharacteristicEnum.MP_REDUCTION),
                    Named("dodge", "Fuite", stats, CharacteristicEnum.TACKLE_EVADE),
                    Named("tackle", "Tacle", stats, CharacteristicEnum.TACKLE_BLOCK),
                    Named("reflect", "Renvoi de dommages", stats, CharacteristicEnum.REFLECT_DAMAGE),
                    Named("critical_damage", "Dommages critiques", stats, CharacteristicEnum.CRITICAL_DAMAGE_BONUS),
                    Named("critical_resist", "Résistance critiques", stats, CharacteristicEnum.CRITICAL_DAMAGE_REDUCTION),
                    Named("push_damage", "Dommages poussée", stats, CharacteristicEnum.PUSH_DAMAGE_BONUS),
                    Named("push_resist", "Résistance poussée", stats, CharacteristicEnum.PUSH_DAMAGE_REDUCTION),
                    Named("trap_damage", "Dommages pièges", stats, CharacteristicEnum.TRAP_DAMAGE_BONUS),
                    Named("trap_power", "Puissance pièges", stats, CharacteristicEnum.TRAP_DAMAGE_BONUS_PERCENT),
                    Named("earth_damage", "Dommages terre", stats, CharacteristicEnum.EARTH_DAMAGE_BONUS),
                    Named("fire_damage", "Dommages feu", stats, CharacteristicEnum.FIRE_DAMAGE_BONUS),
                    Named("water_damage", "Dommages eau", stats, CharacteristicEnum.WATER_DAMAGE_BONUS),
                    Named("air_damage", "Dommages air", stats, CharacteristicEnum.AIR_DAMAGE_BONUS),
                    Named("neutral_damage", "Dommages neutre", stats, CharacteristicEnum.NEUTRAL_DAMAGE_BONUS),
                    Named("earth_reduction", "Réduction terre", stats, CharacteristicEnum.EARTH_ELEMENT_REDUCTION),
                    Named("fire_reduction", "Réduction feu", stats, CharacteristicEnum.FIRE_ELEMENT_REDUCTION),
                    Named("water_reduction", "Réduction eau", stats, CharacteristicEnum.WATER_ELEMENT_REDUCTION),
                    Named("air_reduction", "Réduction air", stats, CharacteristicEnum.AIR_ELEMENT_REDUCTION),
                    Named("neutral_reduction", "Réduction neutre", stats, CharacteristicEnum.NEUTRAL_ELEMENT_REDUCTION),
                },
                guild = guild == null ? null : new
                {
                    id = guild.Id,
                    name = guild.Record.Name,
                    level = guild.Level,
                    experience = guild.Experience,
                    experience_floor = guild.ExperienceLowerBound,
                    experience_next = guild.ExperienceUpperBound,
                    motd = guild.Record.Motd?.Content ?? "",
                    members = guild.Record.Members.ToArray().Select(member => new { member, record = CharacterRecord.GetCharacterRecord(member.CharacterId) })
                        .Where(entry => entry.record != null).Select(entry => new
                        {
                            id = entry.member.CharacterId,
                            name = entry.record.Name,
                            level = ExperienceManager.Instance.GetCharacterLevel(entry.record.Experience),
                            breed_id = entry.record.BreedId,
                            online = guild.IsMemberConnected(entry.member.CharacterId),
                            rank = guild.GetGuildRank(entry.member.Rank)?.Name ?? $"Rang {entry.member.Rank}",
                            note = entry.member.Note ?? "",
                            given_experience = entry.member.GivenExperience,
                            experience_percent = entry.member.ExperienceGivenPercent,
                        }).ToArray(),
                },
                achievement_points = character.AchievementPoints ?? 0,
                shortcuts = character.Record.Shortcuts.OfType<CharacterSpellShortcut>()
                    .OrderBy(item => item.SlotId)
                    .Select(item =>
                    {
                        var spell = SpellRecord.GetSpellRecord(item.SpellId);
                        return new
                        {
                            slot = item.SlotId,
                            spell_id = item.SpellId,
                            name = spell?.Name ?? $"Sort {item.SpellId}",
                        };
                    })
                    .ToArray(),
                spells = character.Record.Spells.Select(item => PackSpell(item.ActiveSpellRecord, character.Level)).ToArray(),
                spell_choices = character.Record.Spells.Select(item => new[] { SpellRecord.GetSpellRecord(item.SpellId), SpellRecord.GetSpellRecord(item.SpellId)?.VariantRecord }
                    .Where(record => record != null).Select(record => PackSpell(record, character.Level)).ToArray()).ToArray(),
                items = character.Inventory.GetItems().Select(item =>
                {
                    var record = ItemRecord.GetItem(item.GId);
                    var weapon = WeaponRecord.GetWeapon(item.GId);
                    return new
                    {
                        uid = item.UId,
                        gid = item.GId,
                        name = record?.Name ?? $"Objet {item.GId}",
                        quantity = item.Quantity,
                        position = (byte)item.Position,
                        equipped = item.IsEquiped(),
                        appearance_id = item.AppearanceId,
                        level = record?.Level ?? 0,
                        usable = record?.Usable ?? false,
                        equip_positions = record == null ? Array.Empty<int>() : ModernEquipmentRules.Positions(record),
                        effects = SerializeEffects(item.Effects),
                        criteria = record?.Criteria ?? "",
                        criteria_ok = string.IsNullOrEmpty(record?.Criteria) ? true : CriteriaExpression.Eval(record.Criteria, client),
                        item_set_id = record?.ItemSetId ?? -1,
                        type_id = (int)(record?.TypeId ?? 0),
                        is_weapon = weapon != null,
                        ap_cost = (int)(weapon?.ApCost ?? 0),
                        min_range = (int)(weapon?.MinRange ?? 0),
                        range = (int)(weapon?.MaxRange ?? 0),
                        critical_hit_probability = (int)(weapon?.CriticalHitProbability ?? 0),
                        average_price = BidshopsManager.Instance.GetAveragePrice(item.GId),
                    };
                }).ToArray(),
                quests = character.GetActiveQuests().Select(quest => new
                {
                    id = quest.QuestId,
                    name = quest.Record?.Name ?? $"Quête {quest.QuestId}",
                    remaining = quest.Objectives?.Count(objective => !objective.Done) ?? 0,
                }).ToArray(),
                jobs = character.Record.Jobs.Select(job =>
                {
                    var experience = job.GetJobExperience();
                    return new
                    {
                        id = job.JobId,
                        name = JobLabel(job.JobId),
                        level = job.Level,
                        experience = job.Experience,
                        experience_floor = experience.jobXpLevelFloor,
                        experience_next = experience.jobXpNextLevelFloor,
                    };
                }).ToArray(),
            };

            return JsonSerializer.Serialize(snapshot);
        }

        private static object PackSpell(SpellRecord record, short characterLevel)
        {
            var grade = record.GetGradeForLevel(characterLevel);
            var level = record.GetLevel((byte)grade);
            return new
            {
                source = "giny",
                id = record.Id, name = record.Name, description = record.Description,
                grade, minimum_level = record.MinimumLevel, available = record.MinimumLevel <= characterLevel &&
                    Catalog.RuntimeCatalog.IsAvailable("spells", record.Id) && Catalog.RuntimeCatalog.IsAvailable("spelllevels", level.Id),
                unavailable_reason = Catalog.RuntimeCatalog.Reason("spells", record.Id) ?? Catalog.RuntimeCatalog.Reason("spelllevels", level.Id),
                obtention_levels = record.Levels.Select(l => l.MinPlayerLevel).ToArray(),
                ap_cost = (int)level.ApCost, min_range = (int)level.MinRange, range = (int)level.MaxRange,
                cast_in_line = level.CastInLine, cast_test_los = level.CastTestLos,
                max_cast_per_turn = (int)level.MaxCastPerTurn, max_cast_per_target = level.MaxCastPerTarget,
                min_cast_interval = level.MinCastInterval, states_criterion = level.StatesCriterion ?? "",
                critical_hit_probability = level.CriticalHitProbability,
                initial_cooldown = level.InitialCooldown, global_cooldown = level.GlobalCooldown, max_stack = level.MaxStack,
                need_free_cell = level.NeedFreeCell, need_taken_cell = level.NeedTakenCell, cast_in_diagonal = level.CastInDiagonal,
                effect_lines = level.HideEffects ? Array.Empty<string>() : level.Effects.Select(effect =>
                {
                    try { return effect.GetDescription(); }
                    catch { return effect.EffectEnum.ToString(); }
                }).ToArray(),
                preview_zones = level.Effects?.Select(e => e.RawZone).Where(z => !string.IsNullOrEmpty(z)).Distinct().ToArray() ?? Array.Empty<string>(),
            };
        }

        private static int TotalOf(EntityStats stats, CharacteristicEnum key)
        {
            try
            {
                return stats[key].Total();
            }
            catch
            {
                return 0;
            }
        }

        private static object Named(string key, string label, EntityStats stats, CharacteristicEnum characteristic)
        {
            return new { key, label, value = Pack(stats, characteristic) };
        }

        private static object Pack(EntityStats stats, CharacteristicEnum key)
        {
            Characteristic characteristic;
            try
            {
                characteristic = stats[key];
            }
            catch
            {
                return new { base_value = 0, additional = 0, equipment = 0, total = 0 };
            }

            if (characteristic is DetailedCharacteristic detailed)
            {
                return new
                {
                    base_value = detailed.Base,
                    additional = detailed.Additional,
                    equipment = detailed.Objects,
                    total = detailed.Total(),
                };
            }

            return new
            {
                base_value = characteristic.Base,
                additional = 0,
                equipment = 0,
                total = characteristic.Total(),
            };
        }

        private static string JobLabel(byte jobId)
        {
            return (JobTypeEnum)jobId switch
            {
                JobTypeEnum.BASE => "Base",
                JobTypeEnum.LUMBERJACK => "Bûcheron",
                JobTypeEnum.SMITH => "Forgeron",
                JobTypeEnum.CARVER => "Sculpteur",
                JobTypeEnum.SHOEMAKER => "Cordonnier",
                JobTypeEnum.JEWELLER => "Bijoutier",
                JobTypeEnum.MINER => "Mineur",
                JobTypeEnum.ALCHEMIST => "Alchimiste",
                JobTypeEnum.TAILOR => "Tailleur",
                JobTypeEnum.FARMER => "Paysan",
                JobTypeEnum.FISHERMAN => "Pêcheur",
                JobTypeEnum.HUNTER => "Chasseur",
                JobTypeEnum.SMITHMAGUS => "Forgemage",
                JobTypeEnum.CARVMAGUS => "Sculptemage",
                JobTypeEnum.ARTIFICER => "Bricoleur",
                JobTypeEnum.SHOEMAGUS => "Cordomage",
                JobTypeEnum.JEWELMAGUS => "Joaillomage",
                JobTypeEnum.COSTUMAGUS => "Costumage",
                JobTypeEnum.HANDYMAN => "Bricoleur",
                JobTypeEnum.CRAFTMAGUS => "Façomage",
                JobTypeEnum.SCROLLMAGE => "Scullemage",
                JobTypeEnum.BEASTOLOGIST => "Éleveur",
                _ => $"Métier {jobId}",
            };
        }

        private static object[] SerializeEffects(EffectCollection effects)
        {
            if (effects == null) return Array.Empty<object>();
            return effects.Select(e =>
            {
                if (e is EffectDice dice)
                {
                    return new
                    {
                        effect_id = (short)dice.EffectEnum,
                        value = dice.Value,
                        min = dice.Min,
                        max = dice.Max,
                    };
                }
                if (e is EffectInteger integer)
                {
                    return new
                    {
                        effect_id = (short)integer.EffectEnum,
                        value = integer.Value,
                        min = integer.Value,
                        max = integer.Value,
                    };
                }
                return new
                {
                    effect_id = (short)e.EffectEnum,
                    value = 0,
                    min = 0,
                    max = 0,
                };
            }).ToArray<object>();
        }
    }
}
