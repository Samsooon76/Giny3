using MySql.Data.MySqlClient;
using System.Security.Cryptography;
using System.Text;

namespace Giny.ORM
{
    /// <summary>Records successful, retryable migrations. DDL is not transactionally rolled back.</summary>
    public static class SchemaMigrations
    {
        public const string CreateHistorySql = @"CREATE TABLE IF NOT EXISTS schema_migrations (
            Module VARCHAR(64) NOT NULL, Version VARCHAR(64) NOT NULL,
            Checksum CHAR(64) NOT NULL, AppliedAt DATETIME(6) NOT NULL,
            PRIMARY KEY (Module, Version)
        ) ENGINE=InnoDB";

        public static bool Apply(MySqlConnection connection, string module, string version, string script)
        {
            if (string.IsNullOrWhiteSpace(module) || module.Length > 64) throw new ArgumentException("Invalid module.", nameof(module));
            if (string.IsNullOrWhiteSpace(version) || version.Length > 64) throw new ArgumentException("Invalid version.", nameof(version));
            var checksum = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(script)));
            var lockName = "giny-schema-" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(connection.Database))).Substring(0, 40);
            lock (DatabaseManager.DatabaseLocker)
            {
                using var acquire = new MySqlCommand("SELECT GET_LOCK(@name, 30)", connection);
                acquire.Parameters.AddWithValue("@name", lockName);
                if (Convert.ToInt32(acquire.ExecuteScalar()) != 1)
                    throw new InvalidOperationException("Unable to acquire the database migration lock.");
                try
                {
                    using (var create = new MySqlCommand(CreateHistorySql, connection)) create.ExecuteNonQuery();
                    using var read = new MySqlCommand("SELECT Checksum FROM schema_migrations WHERE Module=@module AND Version=@version", connection);
                    read.Parameters.AddWithValue("@module", module);
                    read.Parameters.AddWithValue("@version", version);
                    var existing = read.ExecuteScalar();
                    if (existing != null)
                    {
                        if (!string.Equals(Convert.ToString(existing), checksum, StringComparison.OrdinalIgnoreCase))
                            throw new InvalidOperationException($"Migration {module}/{version} has changed since it was applied.");
                        return false;
                    }
                    // Scripts must be safe to retry after a partially applied DDL sequence.
                    new MySqlScript(connection, script).Execute();
                    using var insert = new MySqlCommand("INSERT INTO schema_migrations (Module,Version,Checksum,AppliedAt) VALUES (@module,@version,@checksum,UTC_TIMESTAMP(6))", connection);
                    insert.Parameters.AddWithValue("@module", module);
                    insert.Parameters.AddWithValue("@version", version);
                    insert.Parameters.AddWithValue("@checksum", checksum);
                    insert.ExecuteNonQuery();
                    return true;
                }
                finally
                {
                    using var release = new MySqlCommand("SELECT RELEASE_LOCK(@name)", connection);
                    release.Parameters.AddWithValue("@name", lockName);
                    release.ExecuteScalar();
                }
            }
        }
    }
}
