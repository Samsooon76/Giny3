using System;
using System.Collections.Generic;
using Giny.ORM.Cyclic;
using Giny.ORM.Interfaces;
using Giny.ORM.IO;
using Xunit;

namespace Giny.World.Tests;

public class CyclicSaveQueueTests
{
    private sealed class Queue : CyclicSaveTask
    {
        public Action<IRecord[], DatabaseAction>? DuringWrite;
        public List<(DatabaseAction action, int value)> Writes = new();
        protected override void WriteBatch(Type type, IRecord[] elements, DatabaseAction action)
        {
            foreach (OrmFixtureRecord item in elements) Writes.Add((action, item.Counter));
            DuringWrite?.Invoke(elements, action);
        }
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void UpdateDuringWriteRemainsPending(bool inserting)
    {
        var q = new Queue();
        var record = new OrmFixtureRecord { Id = 1, Counter = 1 };
        if (inserting) q.AddElement(record); else q.UpdateElement(record);
        q.DuringWrite = (_, _) => { record.Counter = 2; q.UpdateElement(record); };
        q.Save();
        q.DuringWrite = null;
        q.Save();
        q.Save();
        Assert.Equal(2, q.Writes.Count);
        Assert.Equal((DatabaseAction.Update, 2), q.Writes[1]);
    }

    [Fact]
    public void DeleteDuringInsertIsPersistedOnNextSave()
    {
        var q = new Queue(); var record = new OrmFixtureRecord { Id = 1 };
        q.AddElement(record);
        q.DuringWrite = (_, _) => q.RemoveElement(record);
        q.Save(); q.DuringWrite = null; q.Save(); q.Save();
        Assert.Equal(new[] { DatabaseAction.Add, DatabaseAction.Remove }, q.Writes.ConvertAll(x => x.action));
    }

    [Fact]
    public void FailedWriteRetriesAndUnwrittenInsertCanBeCancelled()
    {
        var q = new Queue(); var record = new OrmFixtureRecord { Id = 1 };
        q.AddElement(record); q.RemoveElement(record); q.Save();
        Assert.Empty(q.Writes);
        q.UpdateElement(record);
        q.DuringWrite = (_, _) => throw new InvalidOperationException("offline");
        Assert.Throws<AggregateException>(() => q.Save());
        q.DuringWrite = null; q.Save(); q.Save();
        Assert.Equal(2, q.Writes.Count);
    }
}
