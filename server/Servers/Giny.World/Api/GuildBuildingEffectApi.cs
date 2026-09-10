using Giny.World.Managers.Entities.Characters;

namespace Giny.World.Api
{
    /// <summary>
    /// Stable bridge between core gameplay and optional, data-driven guild effects.
    /// The world server deliberately does not reference the GuildCamp module.
    /// </summary>
    public static class GuildBuildingEffectApi
    {
        public delegate double ResolvePercentDelegate(Character character, string effectType);

        public static event ResolvePercentDelegate? ResolvePercent;

        public static double GetPercent(Character character, string effectType)
        {
            if (character == null || string.IsNullOrWhiteSpace(effectType) || ResolvePercent == null)
            {
                return 0;
            }

            double total = 0;
            foreach (ResolvePercentDelegate resolver in ResolvePercent.GetInvocationList())
            {
                total += resolver(character, effectType);
            }
            return total;
        }

        public static long ApplyGain(Character character, string effectType, long baseAmount)
        {
            if (baseAmount <= 0)
            {
                return baseAmount;
            }

            double multiplier = Math.Max(0, 1 + GetPercent(character, effectType) / 100d);
            return (long)Math.Floor(baseAmount * multiplier);
        }

        public static long ApplyCost(Character character, string effectType, long baseAmount)
        {
            if (baseAmount <= 0)
            {
                return baseAmount;
            }

            double multiplier = Math.Max(0, 1 + GetPercent(character, effectType) / 100d);
            return Math.Max(1, (long)Math.Ceiling(baseAmount * multiplier));
        }
    }
}
