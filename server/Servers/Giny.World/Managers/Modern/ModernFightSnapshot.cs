using System.Runtime.CompilerServices;
using Giny.Protocol.Custom.Enums;
using Giny.World.Managers.Stats;
using Giny.World.Managers.Effects;
using Giny.World.Managers.Entities.Look;
using Giny.World.Managers.Fights;
using Giny.World.Managers.Fights.Fighters;

namespace Giny.World.Managers.Modern;

public static class ModernFightSnapshot
{
    private sealed class Identity { public readonly string Id = Guid.NewGuid().ToString(); }
    private static readonly ConditionalWeakTable<Fight, Identity> Identities = new();
    public static string Key(Fight fight) => Identities.GetOrCreateValue(fight).Id;

    public sealed record PreviewCharacteristic(int id, int total);

    // Initiative is health-weighted and deliberately has no contextual total
    // in Giny. Preserve that contract while exporting other fight modifiers.
    public static PreviewCharacteristic[] BuildPreviewStats(EntityStats stats) =>
        stats.GetCharacteristics<Characteristic>().Select(c =>
            new PreviewCharacteristic((int)c.Key, c.Value is InitiativeCharacteristic
                ? c.Value.Total() : c.Value.TotalInContext())).ToArray();

    public static object Build(Fight fight, CharacterFighter observer)
    {
        var playing = fight.FighterPlaying;
        var controlled = playing != null && (playing == observer || playing.GetController() == observer) ? playing : observer;
        return new
        {
            catalog_version = Catalog.RuntimeCatalog.Version,
            fight_key = Key(fight), fight_id = fight.Id, map_id = fight.Map.Id, source_map_id = fight.RoleplayMap.Id,
            phase = fight.Ended ? "finishing" : fight.Started ? "fighting" : "preparation",
            turn = fight.Timeline.RoundNumber, active_id = playing?.Id ?? 0,
            controlled_id = controlled.Id, team = (int)observer.Team.TeamId,
            leader = observer.IsTeamLeader(), ready = observer.IsReady,
            remaining_ms = fight.Started ? Math.Max(0, fight.GetTurnTimeLeft().TotalMilliseconds) : fight.GetPlacementTimeLeft() * 100,
            placement = observer.Team.PlacementCells.Select(c => (int)c.Id).ToArray(),
            enemy_placement = observer.Team.EnemyTeam.PlacementCells.Select(c => (int)c.Id).ToArray(),
            timeline = fight.Timeline.Fighters.Select(f => f.Id).ToArray(),
            cooldowns = ModernCombatEvents.ProtocolValue(controlled.SpellHistory.GetSpellCooldowns()),
            spells = controlled.GetSpells().Select(r => controlled.GetSpell(r.Id)).Where(spell => spell != null).Select(spell => new
            {
                id = spell.Record.Id, name = spell.Record.Name, grade = spell.Level.Grade,
                ap_cost = controlled.GetApCost(spell.Level), min_range = controlled.GetSpellMinimalRange(spell.Level),
                range = controlled.GetSpellRange(spell.Level), cast_in_line = spell.Level.CastInLine,
                cast_test_los = spell.Level.CastTestLos, need_free_cell = spell.Level.NeedFreeCell,
                need_taken_cell = spell.Level.NeedTakenCell, cast_in_diagonal = spell.Level.CastInDiagonal,
                preview_zones = spell.Level.Effects.Select(e => e.RawZone).Where(z => !string.IsNullOrEmpty(z)).Distinct().ToArray(),
                preview_effects = spell.Level.HideEffects || spell.Level.Effects.Any(e => e is not EffectDice) ? null : spell.Level.Effects.OfType<EffectDice>().Select(e => new {
                    effectId = (int)e.EffectId, diceNum = e.Min, diceSide = e.Max, value = e.Value,
                    duration = e.Duration, delay = e.Delay, rawZone = e.RawZone, targetMask = e.TargetMask,
                    triggers = e.RawTriggers, order = e.Order, random = e.Random, group = e.Group,
                }).ToArray(),
                critical_hit_probability = spell.Level.CriticalHitProbability,
                preview_critical_effects = spell.Level.HideEffects || spell.Level.CriticalEffects.Any(e => e is not EffectDice) ? null : spell.Level.CriticalEffects.OfType<EffectDice>().Select(e => new {
                    effectId = (int)e.EffectId, diceNum = e.Min, diceSide = e.Max, value = e.Value,
                    duration = e.Duration, delay = e.Delay, rawZone = e.RawZone, targetMask = e.TargetMask,
                    triggers = e.RawTriggers, order = e.Order, random = e.Random, group = e.Group,
                }).ToArray(),
                available = Catalog.RuntimeCatalog.IsAvailable("spells", spell.Record.Id) && Catalog.RuntimeCatalog.IsAvailable("spelllevels", spell.Level.Id) &&
                    controlled.Alive && controlled.SpellHistory.CanCastSpell(spell.Level) &&
                    spell.Level.EvaluateStateCriterions(controlled) && controlled.Stats.ActionPoints.TotalInContext() >= controlled.GetApCost(spell.Level),
            }).ToArray(),
            fighters = fight.GetFighters<Fighter>(false).Select(f => new
            {                id = f.Id, name = f.Name, level = f.Level,
                look = EntityLookManager.Instance.ConvertToString(f.Look),
                team = (int)f.Team.TeamId,
                cell = f.IsInvisible() && f.Team != observer.Team ? -1 : f.GetFightFighterInformations(observer).disposition.cellId,
                direction = (int)f.Direction, life = f.Stats.LifePoints, max_life = f.Stats.MaxLifePoints,
                shield = f.Stats.ShieldPoints, ap = f.Stats.ActionPoints.TotalInContext(),
                mp = f.Stats.MovementPoints.TotalInContext(), alive = f.Alive, ready = f.IsReady,
                breed = f is CharacterFighter cf ? cf.Character.Record.BreedId : 0,
                // Observable movement profile for previews and recovery. Public
                // fight stats only; hidden positions stay filtered above.
                tackle_block = f.Stats[CharacteristicEnum.TACKLE_BLOCK].TotalInContext(),
                tackle_evade = f.Stats[CharacteristicEnum.TACKLE_EVADE].TotalInContext(),
                dodge_ap = f.Stats[CharacteristicEnum.DODGE_AP_LOST_PROBABILITY].TotalInContext(),
                dodge_mp = f.Stats[CharacteristicEnum.DODGE_MP_LOST_PROBABILITY].TotalInContext(),
                can_tackle = f.CanTackle(), can_be_tackled = f.CanBeTackled(), can_move = f.CanMove(),
                carried = f.IsCarried(), controller_id = (f.GetController() ?? f).Id,
                invisible = f.IsInvisible(),
                preview_stats = BuildPreviewStats(f.Stats),
                preview_complex = f.GetBuffs(false).Any(),
            }).ToArray(),
            // Recipient-filtered marks through the exact same visibility rule as
            // live MarkCells messages: hidden traps expose no coordinates.
            marks = fight.GetMarks().Select(m => ModernCombatEvents.ProtocolValue(fight.GetGameActionMark(observer, m))).ToArray(),
        };
    }

}
