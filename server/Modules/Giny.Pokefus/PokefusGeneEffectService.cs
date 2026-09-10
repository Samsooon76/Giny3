using Giny.Core;
using Giny.Pokefus.Data.Records;
using Giny.Pokefus.Fight.Fighters;
using Giny.Protocol.Custom.Enums;
using Giny.World.Managers.Fights.Fighters;
using Giny.World.Managers.Fights.Stats;
using System.Collections.Concurrent;
using System.Text.Json;

namespace Giny.Pokefus
{
    /// <summary>
    /// Small data-driven interpreter for equipped genome effects. Configuration stays in SQL;
    /// only stable effect families are implemented here.
    /// </summary>
    public static class PokefusGeneEffectService
    {
        private static readonly CharacteristicEnum[] ElementalResistances =
        {
            CharacteristicEnum.NEUTRAL_ELEMENT_RESIST_PERCENT,
            CharacteristicEnum.EARTH_ELEMENT_RESIST_PERCENT,
            CharacteristicEnum.FIRE_ELEMENT_RESIST_PERCENT,
            CharacteristicEnum.WATER_ELEMENT_RESIST_PERCENT,
            CharacteristicEnum.AIR_ELEMENT_RESIST_PERCENT,
        };

        private static readonly ConcurrentDictionary<long, byte> UnsupportedWarnings = new();

        public static void Apply(PokefusFighter fighter, FighterStats stats)
        {
            IReadOnlyList<PokefusGeneRecord> genes =
                PokefusGenomeService.Instance.GetEquippedGenes(fighter.PokefusItem.UId);

            foreach (PokefusGeneRecord gene in genes)
            {
                ApplyGene(fighter, stats, gene);
            }

            ApplyAlliedAuras(fighter, stats);
        }

        private static void ApplyGene(PokefusFighter fighter, FighterStats stats, PokefusGeneRecord gene)
        {
            try
            {
                using JsonDocument document = JsonDocument.Parse(gene.EffectParameters);
                JsonElement parameters = document.RootElement;
                int value = GetInt(parameters, "value");

                switch (gene.EffectType.ToUpperInvariant())
                {
                    case "STAT_PERCENT":
                        if (GetString(parameters, "stat") == "max_health")
                        {
                            int bonus = (int)Math.Round(stats.Life.Base * (value / 100d));
                            stats.Life.Base += bonus;
                            stats.Life.Current += bonus;
                        }
                        break;

                    case "RESISTANCE":
                        ApplyResistance(stats, GetString(parameters, "element"), value);
                        break;

                    case "STAT_FLAT":
                        ApplyFlatStat(stats, GetString(parameters, "stat"), value);
                        break;

                    case "SPELL_DAMAGE":
                        if (GetString(parameters, "scope") == "melee")
                        {
                            stats[CharacteristicEnum.DEALT_DAMAGE_MULTIPLIER_MELEE].Base += value;
                        }
                        else
                        {
                            stats[CharacteristicEnum.DAMAGE_PERCENT_SPELL].Base += value;
                        }
                        break;

                    case "MODIFY_SPELL":
                        if (GetString(parameters, "property") == "damage_percent")
                        {
                            stats[CharacteristicEnum.DAMAGE_PERCENT_SPELL].Base += value;
                        }
                        break;

                    case "PASSIVE_TRIGGER":
                        ApplyPassive(fighter, stats, parameters);
                        break;

                    case "ADD_SPELL":
                        // Dataset entries without a numeric spell_id cannot safely add a spell.
                        // A power fallback remains data-driven for Cri du troupeau.
                        int power = GetInt(parameters, "power");
                        if (power > 0)
                        {
                            stats[CharacteristicEnum.DAMAGE_PERCENT].Base += power;
                        }
                        else
                        {
                            WarnUnsupported(gene, "ADD_SPELL requires spell_id");
                        }
                        break;

                    default:
                        WarnUnsupported(gene, "unknown effect type");
                        break;
                }
            }
            catch (Exception exception)
            {
                Logger.Write(
                    $"[Pokéfus][GENE_EFFECT] gene={gene.Id} invalid configuration: {exception.Message}",
                    Channels.Warning);
            }
        }

        private static void ApplyPassive(PokefusFighter fighter, FighterStats stats, JsonElement parameters)
        {
            string trigger = GetString(parameters, "trigger");
            string effect = GetString(parameters, "effect");
            int value = GetInt(parameters, "value");

            if (trigger == "health_below_percent" && effect == "shield")
            {
                // The initial fighter is at full health; the configured threshold is enforced by
                // fight-time buffs in a future handler. Do not grant the shield prematurely.
                return;
            }

            if (trigger == "allied_pokefus_present" && GetActiveCount(fighter) > 1)
            {
                ApplyFlatStat(stats, GetString(parameters, "stat"), value);
                return;
            }

            if (trigger == "fight_start" && parameters.TryGetProperty("per", out JsonElement per) &&
                per.GetString() == "other_allied_pokefus")
            {
                int otherPokefus = Math.Max(0, GetActiveCount(fighter) - 1);
                if (effect == "power_flat")
                {
                    stats[CharacteristicEnum.DAMAGE_PERCENT].Base += value * otherPokefus;
                }
                return;
            }

            if (trigger == "fight_start" && effect == "resistance")
            {
                ApplyResistance(stats, GetString(parameters, "element"), value);
            }
        }

        private static void ApplyAlliedAuras(PokefusFighter fighter, FighterStats stats)
        {
            if (fighter.Summoner is not CharacterFighter owner)
            {
                return;
            }

            foreach (var item in PokefusManager.Instance.GetPokefusItems(owner.Character.Inventory))
            {
                if (item.UId == fighter.PokefusItem.UId)
                {
                    continue;
                }

                foreach (PokefusGeneRecord gene in PokefusGenomeService.Instance.GetEquippedGenes(item.UId)
                    .Where(x => x.EffectType.Equals("PASSIVE_TRIGGER", StringComparison.OrdinalIgnoreCase)))
                {
                    using JsonDocument document = JsonDocument.Parse(gene.EffectParameters);
                    JsonElement parameters = document.RootElement;
                    if (GetString(parameters, "trigger") == "fight_start" &&
                        GetString(parameters, "target") == "allied_pokefus" &&
                        GetString(parameters, "effect") == "resistance")
                    {
                        ApplyResistance(stats, GetString(parameters, "element"), GetInt(parameters, "value"));
                    }
                }
            }
        }

        private static int GetActiveCount(PokefusFighter fighter)
        {
            return fighter.Summoner is CharacterFighter owner
                ? PokefusManager.Instance.GetActivePokefusCount(owner.Character)
                : 1;
        }

        private static void ApplyFlatStat(FighterStats stats, string stat, int value)
        {
            CharacteristicEnum characteristic = stat switch
            {
                "strength" => CharacteristicEnum.STRENGTH,
                "vitality" => CharacteristicEnum.VITALITY,
                "agility" => CharacteristicEnum.AGILITY,
                "chance" => CharacteristicEnum.CHANCE,
                "intelligence" => CharacteristicEnum.INTELLIGENCE,
                "wisdom" => CharacteristicEnum.WISDOM,
                _ => CharacteristicEnum.UNKNOWN,
            };

            if (characteristic != CharacteristicEnum.UNKNOWN)
            {
                stats[characteristic].Base += value;
            }
        }

        private static void ApplyResistance(FighterStats stats, string element, int value)
        {
            if (element == "all")
            {
                foreach (CharacteristicEnum resistance in ElementalResistances)
                {
                    stats[resistance].Base += value;
                }
                return;
            }

            CharacteristicEnum characteristic = element switch
            {
                "neutral" => CharacteristicEnum.NEUTRAL_ELEMENT_RESIST_PERCENT,
                "earth" => CharacteristicEnum.EARTH_ELEMENT_RESIST_PERCENT,
                "fire" => CharacteristicEnum.FIRE_ELEMENT_RESIST_PERCENT,
                "water" => CharacteristicEnum.WATER_ELEMENT_RESIST_PERCENT,
                "air" => CharacteristicEnum.AIR_ELEMENT_RESIST_PERCENT,
                _ => CharacteristicEnum.UNKNOWN,
            };
            if (characteristic != CharacteristicEnum.UNKNOWN)
            {
                stats[characteristic].Base += value;
            }
        }

        private static int GetInt(JsonElement element, string name)
        {
            return element.TryGetProperty(name, out JsonElement property) && property.TryGetInt32(out int value)
                ? value
                : 0;
        }

        private static string GetString(JsonElement element, string name)
        {
            return element.TryGetProperty(name, out JsonElement property) ? property.GetString() ?? string.Empty : string.Empty;
        }

        private static void WarnUnsupported(PokefusGeneRecord gene, string reason)
        {
            if (UnsupportedWarnings.TryAdd(gene.Id, 0))
            {
                Logger.Write($"[Pokéfus][GENE_EFFECT] gene={gene.Id} ignored: {reason}.", Channels.Warning);
            }
        }
    }
}
