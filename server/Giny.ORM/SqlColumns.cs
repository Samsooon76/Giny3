using Giny.ORM.Attributes;
using System.Reflection;

namespace Giny.ORM
{
    public static class SqlColumns
    {
        public static string Name(PropertyInfo property) =>
            property.GetCustomAttribute<ColumnAttribute>()?.Name ?? property.Name;

        public static string Quote(string name) => "`" + name.Replace("`", "``") + "`";

        public static string List(IEnumerable<PropertyInfo> properties) =>
            string.Join(",", properties.Select(property => Quote(Name(property))));

        public static string Field(IEnumerable<PropertyInfo> properties, string fieldName)
        {
            var property = properties.FirstOrDefault(p => p.Name == fieldName || Name(p) == fieldName)
                ?? throw new ArgumentException($"Unknown record field '{fieldName}'.", nameof(fieldName));
            return Quote(Name(property));
        }
    }
}
