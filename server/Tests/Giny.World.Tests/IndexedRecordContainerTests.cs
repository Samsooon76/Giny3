using System;
using System.Collections;
using Giny.ORM;
using Xunit;

namespace Giny.World.Tests;

public class IndexedRecordContainerTests
{
    [Fact]
    public void OrmAddsTransfersRemovesAndReloadsMaintainOwnerIndex()
    {
        var index = new IndexedRecordContainer<OrmFixtureRecord>(r => r.Counter);
        IDictionary orm = index;
        var first = new OrmFixtureRecord { Id = 1, Counter = 10 };
        var second = new OrmFixtureRecord { Id = 2, Counter = 20 };
        orm.Add(1L, first); orm.Add(2L, second);
        Assert.Equal(new[] { first }, index.ForOwner(10));
        index.ChangeOwner(first, () => first.Counter = 20);
        Assert.Empty(index.ForOwner(10));
        Assert.Equal(2, index.ForOwner(20).Count);
        orm.Remove(1L);
        index.ChangeOwner(first, () => first.Counter = 30);
        Assert.Empty(index.ForOwner(30));
        Assert.Equal(new[] { second }, index.ForOwner(20));
        orm.Clear();
        Assert.Empty(index.ForOwner(20));
        orm.Add(1L, first);
        Assert.Equal(new[] { first }, index.ForOwner(30));
        Assert.Equal(new long[] { 1 }, orm.Keys);
    }

    [Fact]
    public void DuplicateAndReplacementDoNotLeaveStaleIndexEntries()
    {
        var index = new IndexedRecordContainer<OrmFixtureRecord>(r => r.Counter);
        var old = new OrmFixtureRecord { Id = 1, Counter = 10 };
        var replacement = new OrmFixtureRecord { Id = 1, Counter = 20 };
        index.Add(1L, old);
        Assert.Throws<ArgumentException>(() => index.Add(1L, replacement));
        Assert.Empty(index.ForOwner(20));
        index[1L] = replacement;
        index.ChangeOwner(old, () => old.Counter = 50);
        Assert.Empty(index.ForOwner(10));
        Assert.Empty(index.ForOwner(50));
        Assert.Equal(new[] { replacement }, index.ForOwner(20));
    }
}
