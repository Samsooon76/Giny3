using Giny.Core.IO;
using Giny.ORM;
using MySql.Data.MySqlClient;

namespace Giny.World.Records.Guilds
{
    public static class GuildSchemaMigration
    {
        // Stable script: serialized defaults use Giny's own protobuf serializer.
        public static string Script => @"ALTER TABLE guilds
            ADD COLUMN IF NOT EXISTS Ranks BLOB NULL,
            ADD COLUMN IF NOT EXISTS Bulletin BLOB NULL,
            ADD COLUMN IF NOT EXISTS GlobalActivities BLOB NULL,
            ADD COLUMN IF NOT EXISTS ChestActivities BLOB NULL;
            UPDATE guilds SET
                Ranks=COALESCE(Ranks," + Blob(new List<GuildRankRecord>()) + @"),
                Bulletin=COALESCE(Bulletin," + Blob(new GuildBulletinRecord()) + @"),
                GlobalActivities=COALESCE(GlobalActivities," + Blob(new List<GuildGlobalActivityRecord>()) + @"),
                ChestActivities=COALESCE(ChestActivities," + Blob(new List<GuildChestActivityRecord>()) + ");";

        private static string Blob(object value) => "X'" + Convert.ToHexString(Protobuf.Serialize(value)) + "'";

        public static void Apply(MySqlConnection connection)
        {
            // Existing membership cannot safely be assigned guessed ranks/permissions.
            using var column = new MySqlCommand("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='guilds' AND COLUMN_NAME='Ranks'", connection);
            bool hasRanks = Convert.ToInt32(column.ExecuteScalar()) > 0;
            using var guilds = new MySqlCommand(hasRanks
                ? "SELECT COUNT(*) FROM guilds WHERE Ranks IS NULL"
                : "SELECT COUNT(*) FROM guilds", connection);
            if (Convert.ToInt64(guilds.ExecuteScalar()) > 0)
                throw new InvalidOperationException("Legacy guilds have no saved ranks. Restore their ranks and permissions before migrating; no guild data was changed.");

            SchemaMigrations.Apply(connection, "world", "001-guild-columns", Script);
        }
    }
}
