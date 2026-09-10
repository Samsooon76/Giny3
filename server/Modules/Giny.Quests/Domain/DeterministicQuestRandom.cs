using System.Security.Cryptography;
using System.Text;

namespace Giny.Quests.Domain
{
    public sealed class DeterministicQuestRandom
    {
        private ulong state;

        public DeterministicQuestRandom(string seed)
        {
            byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(seed));
            state = BitConverter.ToUInt64(hash, 0);
            if (state == 0)
            {
                state = 0x9E3779B97F4A7C15UL;
            }
        }

        public ulong NextUInt64()
        {
            ulong x = state;
            x ^= x >> 12;
            x ^= x << 25;
            x ^= x >> 27;
            state = x;
            return x * 2685821657736338717UL;
        }

        public double NextDouble() => (NextUInt64() >> 11) * (1.0 / (1UL << 53));

        public int Next(int maxExclusive)
        {
            if (maxExclusive <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(maxExclusive));
            }
            return (int)(NextUInt64() % (uint)maxExclusive);
        }
    }

    public static class QuestTemplateSelector
    {
        /// <summary>
        /// Produces a deterministic weighted order. The first pass maximizes
        /// category and mechanic diversity; remaining candidates are appended in
        /// weighted order so generation can recover from an unavailable target.
        /// </summary>
        public static IReadOnlyList<T> OrderDiverse<T>(
            IEnumerable<T> source,
            Func<T, int> weight,
            Func<T, string> category,
            Func<T, string> mechanic,
            DeterministicQuestRandom random)
        {
            List<(T Item, double Score)> weighted = source
                .Select(item =>
                {
                    double u = Math.Max(double.Epsilon, random.NextDouble());
                    return (Item: item, Score: -Math.Log(u) / Math.Max(1, weight(item)));
                })
                .OrderBy(x => x.Score)
                .ToList();

            List<T> result = new();
            HashSet<string> categories = new(StringComparer.Ordinal);
            HashSet<string> mechanics = new(StringComparer.Ordinal);

            foreach ((T item, _) in weighted)
            {
                if (categories.Add(category(item)) && mechanics.Add(mechanic(item)))
                {
                    result.Add(item);
                }
            }

            foreach ((T item, _) in weighted)
            {
                if (!result.Contains(item))
                {
                    result.Add(item);
                }
            }
            return result;
        }
    }
}
