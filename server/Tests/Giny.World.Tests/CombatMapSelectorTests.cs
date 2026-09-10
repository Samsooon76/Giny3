using System;
using System.Collections.Generic;
using System.Linq;
using Giny.World.Managers.Fights;
using Giny.World.Records.Maps;
using Xunit;

namespace Giny.World.Tests;

public class CombatMapSelectorTests
{
    private static MapRecord Map(long id, int size = 4) => new MapRecord
    {
        Id = id, SubareaId = 7,
        Cells = Enumerable.Range(0, 560).Select(i => new CellRecord { Id = (short)i, LosMov = 0 }).ToArray(),
        BlueCells = Enumerable.Range(0, size).Select(i => new CellRecord { Id = (short)i }).ToList(),
        RedCells = Enumerable.Range(40, size).Select(i => new CellRecord { Id = (short)i }).ToList(),
    };

    [Fact]
    public void ChoosesAnArenaFromTheZoneWithoutChangingTheSource()
    {
        var source = Map(1); var a = Map(2); var b = Map(3);
        var all = new[] { source, a, b }.ToDictionary(m => m.Id);
        var selector = new CombatMapSelector(new() { [7] = new long[] { 2, 3 } }, new(), id => all.GetValueOrDefault(id)!);
        Assert.Same(b, selector.Select(source, 2, 2, n => n - 1));
        Assert.Equal(1, source.Id);
        Assert.Equal(7, source.SubareaId);
    }

    [Fact]
    public void ExactMapOverridesTheZoneAndEmptyOverrideDisablesRedirection()
    {
        var source = Map(1); var a = Map(2); var b = Map(3);
        var all = new[] { source, a, b }.ToDictionary(m => m.Id);
        var zones = new Dictionary<short, long[]> { [7] = new long[] { 2 } };
        var selector = new CombatMapSelector(zones, new() { [1] = new long[] { 3 } }, id => all.GetValueOrDefault(id)!);
        Assert.Same(b, selector.Select(source, 1, 1));
        selector = new CombatMapSelector(zones, new() { [1] = Array.Empty<long>() }, id => all.GetValueOrDefault(id)!);
        Assert.Same(source, selector.Select(source, 1, 1));
    }

    [Fact]
    public void FiltersSmallPoolsAndRefusesWhenNoArenaCanFitTheTeams()
    {
        var source = Map(1); var small = Map(2, 1); var large = Map(3, 3);
        var all = new[] { source, small, large }.ToDictionary(m => m.Id);
        var selector = new CombatMapSelector(new() { [7] = new long[] { 2, 3 } }, new(), id => all.GetValueOrDefault(id)!);
        Assert.Same(large, selector.Select(source, 2, 2));
        Assert.Null(selector.Select(source, 4, 4)); // Do not silently fight on the RP map for a configured pool.
    }

    [Fact]
    public void PreservesDungeonRoomsUnlessExplicitlyConfigured()
    {
        var source = Map(1); source.Dungeon = new DungeonRecord(); var arena = Map(2);
        MapRecord Lookup(long id) => id == 1 ? source : arena;
        Assert.Same(source, new CombatMapSelector(new() { [7] = new long[] { 2 } }, new(), Lookup).Select(source, 1, 1));
        Assert.Same(arena, new CombatMapSelector(new(), new() { [1] = new long[] { 2 } }, Lookup).Select(source, 1, 1));
    }

    [Fact]
    public void RejectsMissingMapsAndInvalidOrOverlappingPlacementCells()
    {
        Assert.Throws<InvalidOperationException>(() => new CombatMapSelector(new() { [7] = new long[] { 2 } }, new(), _ => null!));
        var map = Map(2); map.RedCells = map.BlueCells;
        Assert.False(CombatMapSelector.HasCapacity(map, 1, 1));
        Assert.Throws<InvalidOperationException>(() => new CombatMapSelector(new() { [7] = new long[] { 2 } }, new(), _ => map));
        map = Map(2, 1); map.Cells[0].LosMov = 1;
        Assert.False(CombatMapSelector.HasCapacity(map, 1, 1));
    }

    [Fact]
    public void UnconfiguredZonesKeepTheExistingMap()
    {
        var source = Map(1);
        Assert.Same(source, new CombatMapSelector().Select(source, 1, 1));
    }
}
