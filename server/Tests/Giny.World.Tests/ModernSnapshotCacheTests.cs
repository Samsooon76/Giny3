using System;
using Giny.World.Managers.Modern;
using Xunit;
namespace Giny.World.Tests;
public class ModernSnapshotCacheTests
{
    [Fact]
    public void IdleReconciliationDoesNotRebuildAndStateChangesDo()
    {
        var cache = new ModernSnapshotCache();
        var owner = new object(); var builds = 0;
        string Build() => (++builds).ToString();
        Assert.Equal("1", cache.Read(owner, 0, Build, false, 0));
        Assert.Equal("1", cache.Read(owner, 0, Build, false, 2000));
        Assert.Equal("2", cache.Read(owner, 1, Build, false, 4000));
        Assert.Equal("3", cache.Read(owner, 1, Build, true, 4001));
        Assert.Equal("4", cache.Read(new object(), 1, Build, false, 4002));
        Assert.Equal(4, builds);
    }
    [Fact]
    public void SilentLegacyMutationIsReconciledAndFailedBuildCanRetry()
    {
        var cache = new ModernSnapshotCache(); var owner = new object();
        cache.Read(owner, 0, () => "first", false, 0);
        Assert.Equal("first", cache.Read(owner, 0, () => "changed", false, 29999));
        Assert.Throws<InvalidOperationException>(() => cache.Read(owner, 0, () => throw new InvalidOperationException(), false, 30000));
        Assert.Equal("changed", cache.Read(owner, 0, () => "changed", false, 30001));
    }
}
