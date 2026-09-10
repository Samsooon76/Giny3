using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Giny.ORM.Interfaces;

namespace Giny.ORM
{
    /// <summary>ORM-compatible container with an atomic secondary owner index.</summary>
    public sealed class IndexedRecordContainer<T> : IDictionary where T : class, IRecord
    {
        private readonly object sync = new();
        private readonly Dictionary<long, T> records = new();
        private readonly Dictionary<long, Dictionary<long, T>> owners = new();
        private readonly Func<T, long> ownerOf;
        public IndexedRecordContainer(Func<T, long> ownerOf) { this.ownerOf = ownerOf; }

        public List<T> ForOwner(long owner)
        {
            lock (sync) return owners.TryGetValue(owner, out var items) ? items.Values.ToList() : new List<T>();
        }

        /// <summary>Change an indexed property together with its index; detached records stay detached.</summary>
        public void ChangeOwner(T record, Action change)
        {
            lock (sync)
            {
                var tracked = records.TryGetValue(record.Id, out var current) && ReferenceEquals(current, record);
                if (tracked) Unindex(record);
                try { change(); }
                finally { if (tracked) Index(record); }
            }
        }

        private void Index(T record)
        {
            var owner = ownerOf(record);
            if (!owners.TryGetValue(owner, out var items)) owners[owner] = items = new();
            items.Add(record.Id, record);
        }
        private void Unindex(T record)
        {
            var owner = ownerOf(record);
            if (!owners.TryGetValue(owner, out var items)) return;
            items.Remove(record.Id);
            if (items.Count == 0) owners.Remove(owner);
        }
        public void Add(object key, object value)
        {
            var record = (T)value;
            if ((long)key != record.Id) throw new ArgumentException("Container key must match record identity.");
            lock (sync) { records.Add(record.Id, record); Index(record); }
        }
        public void Remove(object key)
        {
            lock (sync) if (records.Remove((long)key, out var record)) Unindex(record);
        }
        public void Clear() { lock (sync) { records.Clear(); owners.Clear(); } }
        public bool Contains(object key) { lock (sync) return records.ContainsKey((long)key); }
        public object this[object key]
        {
            get { lock (sync) return records.TryGetValue((long)key, out var value) ? value : null; }
            set
            {
                var record = (T)value;
                if ((long)key != record.Id) throw new ArgumentException("Container key must match record identity.");
                lock (sync) { Remove(key); Add(key, value); }
            }
        }
        public ICollection Keys { get { lock (sync) return records.Keys.ToArray(); } }
        public ICollection Values { get { lock (sync) return records.Values.ToArray(); } }
        public int Count { get { lock (sync) return records.Count; } }
        public bool IsReadOnly => false;
        public bool IsFixedSize => false;
        public bool IsSynchronized => true;
        public object SyncRoot => sync;
        public IDictionaryEnumerator GetEnumerator()
        {
            lock (sync) return ((IDictionary)new Dictionary<long, T>(records)).GetEnumerator();
        }
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
        public void CopyTo(Array array, int index)
        {
            lock (sync) ((ICollection)new Dictionary<long, T>(records)).CopyTo(array, index);
        }
    }
}
