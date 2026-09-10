using System;
using System.Collections.Generic;
using System.Linq;
using Giny.Core;
using Giny.Core.DesignPattern;
using Giny.Core.IO.Configuration;
using Giny.World.Records.Maps;

namespace Giny.World.Managers.Fights
{
    /// <summary>Server-owned PvM arenas; a source map override takes precedence over its zone.</summary>
    public sealed class CombatMapSelector
    {
        public static CombatMapSelector Instance { get; private set; } = new CombatMapSelector();
        private readonly Dictionary<short, MapRecord[]> zones = new();
        private readonly Dictionary<long, MapRecord[]> sources = new();

        public CombatMapSelector() { }

        public CombatMapSelector(Dictionary<short, long[]> zoneIds, Dictionary<long, long[]> sourceIds,
            Func<long, MapRecord> lookup)
        {
            MapRecord[] Resolve(long[] ids)
            {
                if (ids == null) throw new InvalidOperationException("Combat map pool cannot be null.");
                return ids.Distinct().Select(id =>
                {
                    var map = lookup(id) ?? throw new InvalidOperationException($"Unknown combat map {id}.");
                    if (!HasCapacity(map, 1, 1))
                        throw new InvalidOperationException($"Combat map {id} has no valid placement cells for both teams.");
                    return map;
                }).ToArray();
            }
            foreach (var entry in zoneIds ?? throw new InvalidOperationException("CombatMapsBySubarea cannot be null."))
                zones.Add(entry.Key, Resolve(entry.Value));
            foreach (var entry in sourceIds ?? throw new InvalidOperationException("CombatMapsByMap cannot be null."))
            {
                if (lookup(entry.Key) == null) throw new InvalidOperationException($"Unknown source map {entry.Key}.");
                sources.Add(entry.Key, Resolve(entry.Value));
            }
        }

        [StartupInvoke("Combat map pools", StartupInvokePriority.Last)]
        public static void Initialize()
        {
            var config = ConfigManager<WorldConfig>.Instance;
            Instance = new CombatMapSelector(config.CombatMapsBySubarea, config.CombatMapsByMap, MapRecord.GetMap);
            Logger.Write($"Combat map pools: {Instance.zones.Count} zones, {Instance.sources.Count} map overrides.");
        }

        public static List<CellRecord> Placement(MapRecord map, bool blue) =>
            ((blue ? map.BlueCells : map.RedCells) ?? new List<CellRecord>())
                .Where(cell => cell != null && cell.Id >= 0 && cell.Id < (map.Cells?.Length ?? 0)
                    && map.Cells[cell.Id] != null && map.Cells[cell.Id].IsValidFightCell())
                .GroupBy(cell => cell.Id).Select(group => map.Cells[group.Key]).ToList();

        public static bool HasCapacity(MapRecord map, int blue, int red)
        {
            var a = Placement(map, true);
            var b = Placement(map, false);
            return a.Count >= blue && b.Count >= red && !a.Select(c => c.Id).Intersect(b.Select(c => c.Id)).Any();
        }

        public MapRecord Select(MapRecord source, int blue, int red, Func<int, int> choose = null)
        {
            // Dungeon progression is kept unless the exact room is explicitly mapped.
            MapRecord[] pool;
            if (!sources.TryGetValue(source.Id, out pool)
                && (source.IsDungeonMap || !zones.TryGetValue(source.SubareaId, out pool)))
                pool = Array.Empty<MapRecord>();
            if (pool.Length == 0) return HasCapacity(source, blue, red) ? source : null;
            var candidates = pool.Where(map => HasCapacity(map, blue, red)).ToArray();
            return candidates.Length == 0 ? null : candidates[(choose ?? Random.Shared.Next)(candidates.Length)];
        }
    }
}
