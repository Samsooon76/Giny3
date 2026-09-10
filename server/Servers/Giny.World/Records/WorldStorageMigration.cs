using Giny.ORM;
using MySql.Data.MySqlClient;

namespace Giny.World.Records
{
    public static class WorldStorageMigration
    {
        public const string Script = @"ALTER TABLE characters ENGINE=InnoDB;
            ALTER TABLE character_items ENGINE=InnoDB;";

        public static void Apply(MySqlConnection connection) =>
            SchemaMigrations.Apply(connection, "world", "002-transactional-player-storage", Script);
    }
}
