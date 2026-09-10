using Giny.Core;
using Giny.Core.DesignPattern;
using Giny.ORM.Interfaces;
using Giny.ORM.IO;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Giny.ORM.Cyclic
{
    public class CyclicSaveTask : Singleton<CyclicSaveTask>
    {
        private readonly object saveLock = new();
        private readonly object sync = new();
        private readonly Dictionary<IRecord, Pending> pending = new(ReferenceEqualityComparer.Instance);
        private readonly HashSet<IRecord> inFlight = new(ReferenceEqualityComparer.Instance);
        private long generation;
        private sealed record Pending(DatabaseAction Action, long Generation);

        public void AddElement(IRecord element)
        {
            if (element == null) return;
            lock (sync)
            {
                var action = DatabaseAction.Add;
                if (pending.TryGetValue(element, out var previous))
                {
                    if (previous.Action != DatabaseAction.Remove) return;
                    // An unsaved removal can be replaced by updating the existing row.
                    if (!inFlight.Contains(element)) action = DatabaseAction.Update;
                }
                pending[element] = new Pending(action, ++generation);
            }
        }

        public void UpdateElement(IRecord element)
        {
            if (element == null) return;
            lock (sync)
            {
                var action = DatabaseAction.Update;
                if (pending.TryGetValue(element, out var previous))
                {
                    if (previous.Action == DatabaseAction.Remove) return;
                    action = previous.Action;
                }
                pending[element] = new Pending(action, ++generation);
            }
        }

        public void RemoveElement(IRecord element)
        {
            if (element == null) return;
            lock (sync)
            {
                if (pending.TryGetValue(element, out var previous) && previous.Action == DatabaseAction.Add
                    && !inFlight.Contains(element))
                {
                    pending.Remove(element);
                    return;
                }
                pending[element] = new Pending(DatabaseAction.Remove, ++generation);
            }
        }

        public void Save()
        {
            lock (saveLock)
            {
                KeyValuePair<IRecord, Pending>[] snapshot;
                lock (sync)
                {
                    snapshot = pending.ToArray();
                    foreach (var item in snapshot) inFlight.Add(item.Key);
                }
                var failures = new List<Exception>();
                try
                {
                    foreach (var action in new[] { DatabaseAction.Remove, DatabaseAction.Add, DatabaseAction.Update })
                    foreach (var batch in snapshot.Where(x => x.Value.Action == action).GroupBy(x => x.Key.GetType()))
                    {
                        try
                        {
                            WriteBatch(batch.Key, batch.Select(x => x.Key).ToArray(), action);
                            lock (sync)
                            {
                                foreach (var item in batch)
                                {
                                    if (!pending.TryGetValue(item.Key, out var current)) continue;
                                    if (current.Generation == item.Value.Generation) pending.Remove(item.Key);
                                    else if (action == DatabaseAction.Add && current.Action == DatabaseAction.Add)
                                        // Insert completed, but newer values still need a subsequent UPDATE.
                                        pending[item.Key] = current with { Action = DatabaseAction.Update };
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            lock (sync)
                            {
                                // A failed removal left the row in place. A concurrent re-add
                                // must update it, rather than retry as a duplicate insertion.
                                if (action == DatabaseAction.Remove)
                                    foreach (var item in batch)
                                        if (pending.TryGetValue(item.Key, out var current) && current.Action == DatabaseAction.Add)
                                            pending[item.Key] = current with { Action = DatabaseAction.Update };
                            }
                            failures.Add(new InvalidOperationException($"Unable to {action} records of type {batch.Key.Name}.", ex));
                            Logger.Write(ex.Message, Channels.Critical);
                        }
                    }
                }
                finally { lock (sync) inFlight.Clear(); }
                if (failures.Count > 0)
                    throw new AggregateException("Some records could not be saved; failed batches remain pending.", failures);
            }
        }

        protected virtual void WriteBatch(Type type, IRecord[] elements, DatabaseAction action)
            => TableManager.Instance.GetWriter(type).Use(elements, action);
    }
}
