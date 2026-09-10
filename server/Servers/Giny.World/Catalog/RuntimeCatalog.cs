using System.Collections.Concurrent;
using Giny.Core.DesignPattern;
using Giny.ORM;
using MySql.Data.MySqlClient;

namespace Giny.World.Catalog;

public static class RuntimeCatalog
{
    static readonly ConcurrentDictionary<(string, long), string> Unavailable = new();
    public static string? Version { get; private set; }
    public static bool IsAvailable(string domain, long id) => !Unavailable.ContainsKey((domain, id));
    public static string? Reason(string domain, long id) => Unavailable.TryGetValue((domain, id), out var reason) ? reason : null;

    [StartupInvoke("Catalogue compatibility", StartupInvokePriority.ThirdPass)]
    public static void Initialize()
    {
        Unavailable.Clear();
        Version = null;
        var connection = DatabaseManager.Instance.UseProvider();
        using var exists = new MySqlCommand("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='catalog_runtime_status'", connection);
        if (Convert.ToInt64(exists.ExecuteScalar()) == 0) return;
        using (var version = new MySqlCommand("SELECT CatalogVersion FROM catalog_runtime_release WHERE Id=1", connection))
            Version = version.ExecuteScalar()?.ToString();
        using var command = new MySqlCommand("SELECT Domain,RecordId,Reasons FROM catalog_runtime_status WHERE Available=0", connection);
        using var reader = command.ExecuteReader();
        while (reader.Read()) Unavailable[(reader.GetString(0), reader.GetInt64(1))] = reader.GetString(2);
    }
}
