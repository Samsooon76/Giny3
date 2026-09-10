using System;

namespace Giny.ORM.Attributes
{
    /// <summary>Maps a record property to an existing SQL column without renaming persisted data.</summary>
    [AttributeUsage(AttributeTargets.Property, Inherited = true)]
    public sealed class ColumnAttribute : Attribute
    {
        public string Name { get; }

        public ColumnAttribute(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Column name is required.", nameof(name));
            Name = name;
        }
    }
}
