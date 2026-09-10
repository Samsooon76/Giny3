using System;
using System.Collections.Generic;
using System.Linq;
using Giny.Core.IO;
using Giny.ORM;
using Giny.ORM.Attributes;
using Giny.ORM.Interfaces;
using Giny.ORM.IO;
using Giny.World.Records.Guilds;
using Giny.World.Managers.Guilds;
using Giny.World.Records;
using MySql.Data.MySqlClient;
using ProtoBuf;
using Xunit;

namespace Giny.World.Tests
{
    public sealed class MariaDbFactAttribute : FactAttribute
    {
        public MariaDbFactAttribute()
        {
            if (Environment.GetEnvironmentVariable("GINY_ORM_INTEGRATION") != "1")
                Skip = "Set GINY_ORM_INTEGRATION=1 to use an isolated, disposable local MariaDB database.";
        }
    }

    [CollectionDefinition("ORM persistence", DisableParallelization = true)]
    public class OrmPersistenceCollection { }

    [Collection("ORM persistence")]
    public sealed class OrmPersistenceTests : IDisposable
    {
        private readonly string database = "giny_orm_test_" + Guid.NewGuid().ToString("N");
        private readonly MySqlConnection admin;
        private readonly MySqlConnection connection;

        public OrmPersistenceTests()
        {
            var port = uint.Parse(Environment.GetEnvironmentVariable("GINY_ORM_TEST_PORT") ?? "3307");
            var user = Environment.GetEnvironmentVariable("GINY_ORM_TEST_USER") ?? "root";
            var password = Environment.GetEnvironmentVariable("GINY_ORM_TEST_PASSWORD") ?? "";
            admin = new MySqlConnection(new MySqlConnectionStringBuilder
            {
                Server = "127.0.0.1", Port = port, UserID = user, Password = password, Pooling = false
            }.ConnectionString);
            admin.Open();
            using (var create = new MySqlCommand($"CREATE DATABASE `{database}`", admin)) create.ExecuteNonQuery();
            try
            {
                DatabaseManager.Instance.Initialize(typeof(OrmPersistenceTests).Assembly, "127.0.0.1", database, user, password, port);
                connection = DatabaseManager.Instance.UseProvider();
                Execute(@"CREATE TABLE orm_fixture (
                    Extra VARCHAR(30) NOT NULL DEFAULT 'untouched',
                    Payload BLOB NULL, LegacyName VARCHAR(100) NOT NULL,
                    Counter INT NOT NULL, Id BIGINT NOT NULL PRIMARY KEY
                ) ENGINE=InnoDB");
            }
            catch
            {
                using var drop = new MySqlCommand($"DROP DATABASE `{database}`", admin);
                drop.ExecuteNonQuery();
                admin.Dispose();
                throw;
            }
        }

        [MariaDbFact]
        public async System.Threading.Tasks.Task IndependentTransactionsAndReadsDoNotWaitForAnotherOperation()
        {
            var entered = new System.Threading.Tasks.TaskCompletionSource<long>(System.Threading.Tasks.TaskCreationOptions.RunContinuationsAsynchronously);
            var release = new System.Threading.ManualResetEventSlim();
            var held = System.Threading.Tasks.Task.Run(() => DatabaseManager.Instance.ExecuteTransaction((c, t) =>
            {
                using var id = new MySqlCommand("SELECT CONNECTION_ID()", c, t);
                entered.SetResult(Convert.ToInt64(id.ExecuteScalar()));
                if (!release.Wait(TimeSpan.FromSeconds(10))) throw new TimeoutException("Test release missing");
                return true;
            }));
            try
            {
                var firstId = await entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
                var independent = System.Threading.Tasks.Task.Run(() => DatabaseManager.Instance.ExecuteTransaction((c, t) =>
                {
                    using var id = new MySqlCommand("SELECT CONNECTION_ID()", c, t);
                    return Convert.ToInt64(id.ExecuteScalar());
                }));
                Assert.NotEqual(firstId, await independent.WaitAsync(TimeSpan.FromSeconds(5)));
                var count = System.Threading.Tasks.Task.Run(() => DatabaseReader.Count<OrmFixtureRecord>());
                Assert.Equal(0, await count.WaitAsync(TimeSpan.FromSeconds(5)));
            }
            finally { release.Set(); await held; release.Dispose(); }
        }

        [MariaDbFact]
        public void InsertFailureInSecondChunkRollsBackFirstChunk()
        {
            var rows = Enumerable.Range(1, 501).Select(i => new OrmFixtureRecord { Id = i, Name = "batch", Counter = i }).ToArray();
            rows[500].Id = 1;
            Assert.ThrowsAny<Exception>(() => DatabaseWriter.Insert(rows));
            Assert.Equal(0L, Scalar("SELECT COUNT(*) FROM orm_fixture"));
            rows[500].Id = 501;
            DatabaseWriter.Insert(rows);
            Assert.Equal(501L, Scalar("SELECT COUNT(*) FROM orm_fixture"));
            DatabaseWriter.Delete(rows);
            Assert.Equal(0L, Scalar("SELECT COUNT(*) FROM orm_fixture"));
        }

        [MariaDbFact]
        public void UpdateFailureInSecondChunkRollsBackEarlierUpdates()
        {
            var rows = Enumerable.Range(1, 501).Select(i => new OrmFixtureRecord { Id = i, Name = "before", Counter = 0 }).ToArray();
            DatabaseWriter.Insert(rows);
            Execute("ALTER TABLE orm_fixture ADD CONSTRAINT counter_nonnegative CHECK (Counter >= 0)");
            foreach (var row in rows) row.Counter = 1;
            rows[500].Counter = -1;
            Assert.ThrowsAny<Exception>(() => DatabaseWriter.Update(rows));
            Assert.Equal(0L, Convert.ToInt64(Scalar("SELECT SUM(Counter) FROM orm_fixture")));
        }

        [MariaDbFact]
        public void FailedPeriodicWriteRemainsPendingUntilARecoverySave()
        {
            var queue = new Giny.ORM.Cyclic.CyclicSaveTask();
            var item = new OrmFixtureRecord { Id = 123, Name = "retry", Counter = 5 };
            queue.AddElement(item);
            Execute("RENAME TABLE orm_fixture TO orm_fixture_unavailable");
            Assert.Throws<AggregateException>(() => queue.Save());
            Execute("RENAME TABLE orm_fixture_unavailable TO orm_fixture");
            queue.Save();
            Assert.Equal(5, DatabaseReader.ReadFirst<OrmFixtureRecord>("Id", "123").Counter);
            item.Counter = 9;
            queue.UpdateElement(item);
            Execute("RENAME TABLE orm_fixture TO orm_fixture_unavailable");
            Assert.Throws<AggregateException>(() => queue.Save());
            Execute("RENAME TABLE orm_fixture_unavailable TO orm_fixture");
            queue.Save();
            queue.Save();
            Assert.Equal(9, DatabaseReader.ReadFirst<OrmFixtureRecord>("Id", "123").Counter);
            queue.RemoveElement(item);
            Execute("RENAME TABLE orm_fixture TO orm_fixture_unavailable");
            Assert.Throws<AggregateException>(() => queue.Save());
            Execute("RENAME TABLE orm_fixture_unavailable TO orm_fixture");
            queue.Save();
            Assert.Null(DatabaseReader.ReadFirst<OrmFixtureRecord>("Id", "123"));
        }

        [MariaDbFact]
        public void ReorderedColumnsExtraDefaultsAliasesAndInheritedKeysRoundTrip()
        {
            var record = new OrmFixtureRecord
            {
                Id = 42, Name = "L'épée", Counter = 7,
                Payload = new List<OrmPayload> { new OrmPayload { Value = 123 } }
            };
            DatabaseWriter.Insert(record);
            var loaded = DatabaseReader.ReadFirst<OrmFixtureRecord>("Name", "L'épée");
            Assert.Equal(42, loaded.Id);
            Assert.Equal(7, loaded.Counter);
            Assert.Equal(123, Assert.Single(loaded.Payload!).Value);
            Assert.Equal("untouched", Scalar("SELECT Extra FROM orm_fixture WHERE Id=42"));
            Assert.Null(DatabaseReader.ReadFirst<OrmFixtureRecord>("Name", "' OR 1=1 -- "));

            loaded.Name = "Modifié";
            loaded.Counter = 9;
            loaded.Payload = null;
            DatabaseWriter.Update(loaded);
            var updated = Assert.Single(DatabaseReader.Select<OrmFixtureRecord>("Name", "Modifié"));
            Assert.Equal(9, updated.Counter);
            Assert.Null(updated.Payload);
            Assert.Equal("untouched", Scalar("SELECT Extra FROM orm_fixture WHERE Id=42"));
            var filtered = new DatabaseReader(typeof(OrmFixtureRecord));
            filtered.Read(connection, "Counter=100");
            Assert.Empty(filtered.Elements);
            DatabaseWriter.Insert(Array.Empty<OrmFixtureRecord>());
            DatabaseWriter.Delete(updated);
            Assert.Equal(0L, Scalar("SELECT COUNT(*) FROM orm_fixture"));
        }

        [MariaDbFact]
        public void SchemaFailureIsExplicitAndDoesNotDestroyRows()
        {
            Execute("INSERT INTO orm_fixture (Id,LegacyName,Counter) VALUES (1,'kept',3)");
            Execute("ALTER TABLE orm_fixture DROP COLUMN Counter");
            Assert.Throws<InvalidOperationException>(() => DatabaseReader.Select<OrmFixtureRecord>().ToArray());
            Assert.Throws<InvalidOperationException>(() => DatabaseReader.ReadFirst<OrmFixtureRecord>("Id", "1"));
            Assert.Equal("kept", Scalar("SELECT LegacyName FROM orm_fixture WHERE Id=1"));
            // Readers were disposed even on error; the shared connection remains usable.
            Assert.Equal(1L, Scalar("SELECT COUNT(*) FROM orm_fixture"));
        }

        [MariaDbFact]
        public void ItemInsertAndClaimRollbackTogetherAndStorageConversionKeepsRows()
        {
            Execute("CREATE TABLE characters (Id BIGINT PRIMARY KEY,Kamas BIGINT) ENGINE=MyISAM");
            Execute("CREATE TABLE character_items (Id BIGINT PRIMARY KEY) ENGINE=MyISAM");
            Execute("INSERT INTO characters VALUES (1,100)");
            Execute("INSERT INTO character_items VALUES (7)");
            WorldStorageMigration.Apply(connection);
            WorldStorageMigration.Apply(connection);
            Assert.Equal(2L, Scalar("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('characters','character_items') AND ENGINE='InnoDB'"));
            Assert.Equal(7L, Scalar("SELECT Id FROM character_items"));
            Execute("CREATE TABLE claims (Id INT PRIMARY KEY) ENGINE=InnoDB");
            var item = new OrmFixtureRecord { Id = 91, Name = "reward", Counter = 1 };
            Assert.Throws<InvalidOperationException>(() => DatabaseManager.Instance.ExecuteTransaction<int>((c,t) =>
            {
                using var claim = new MySqlCommand("INSERT INTO claims VALUES (1); UPDATE characters SET Kamas=150 WHERE Id=1", c,t);
                claim.ExecuteNonQuery();
                DatabaseWriter.InsertTransactional(new[] { item }, c,t);
                throw new InvalidOperationException("interrupted before commit");
            }));
            Assert.Equal(0L, Scalar("SELECT COUNT(*) FROM claims"));
            Assert.Equal(0L, Scalar("SELECT COUNT(*) FROM orm_fixture"));
            Assert.Equal(100L, Scalar("SELECT Kamas FROM characters WHERE Id=1"));
            DatabaseManager.Instance.ExecuteTransaction((c,t) =>
            {
                using var claim = new MySqlCommand("INSERT INTO claims VALUES (1)", c,t);
                claim.ExecuteNonQuery();
                DatabaseWriter.InsertTransactional(new[] { item }, c,t);
                return true;
            });
            Assert.Equal("reward", DatabaseReader.ReadFirst<OrmFixtureRecord>("Id", "91").Name);
            Assert.Equal(1L, Scalar("SELECT COUNT(*) FROM claims"));
        }

        [MariaDbFact]
        public void MigrationIsRecordedOnceAndRejectsChangedOrFailedScripts()
        {
            const string script = "CREATE TABLE IF NOT EXISTS migration_probe (Id INT PRIMARY KEY); INSERT INTO migration_probe VALUES (1);";
            Assert.True(SchemaMigrations.Apply(connection, "test", "001", script));
            Assert.False(SchemaMigrations.Apply(connection, "test", "001", script));
            Assert.Throws<InvalidOperationException>(() => SchemaMigrations.Apply(connection, "test", "001", script + " "));
            Assert.Equal(1L, Scalar("SELECT COUNT(*) FROM migration_probe"));
            Assert.ThrowsAny<Exception>(() => SchemaMigrations.Apply(connection, "test", "002", "INVALID SQL"));
            Assert.Equal(0L, Scalar("SELECT COUNT(*) FROM schema_migrations WHERE Version='002'"));
            Assert.True(SchemaMigrations.Apply(connection, "test", "002", "INSERT INTO migration_probe VALUES (2)"));
        }

        [MariaDbFact]
        public void LegacyEmptyGuildSchemaMigratesAndPersistsExperience()
        {
            CreateLegacyGuildTable();
            GuildSchemaMigration.Apply(connection);
            GuildSchemaMigration.Apply(connection);
            TableManager.Instance.RegisterTypes(new[] { typeof(GuildRecord) });
            var guild = new GuildRecord
            {
                Id = 900, Name = "Fixture", CreationDate = new DateTime(2026, 9, 5), Experience = 0,
                Emblem = new GuildEmblemRecord(), Members = new List<GuildMemberRecord>(),
                Motd = new GuildMotdRecord(), Ranks = new List<GuildRankRecord>(),
                Bulletin = new GuildBulletinRecord(), GlobalActivities = new List<GuildGlobalActivityRecord>(),
                ChestActivities = new List<GuildChestActivityRecord>()
            };
            DatabaseWriter.Insert(guild);
            guild.Experience = 12345;
            DatabaseWriter.Update(guild);
            var loaded = DatabaseReader.ReadFirst<GuildRecord>("Id", "900");
            Assert.Equal(12345, loaded.Experience);
            Assert.NotNull(loaded.Ranks);
            Assert.NotNull(loaded.Bulletin);
            Assert.NotNull(loaded.GlobalActivities);
            Assert.NotNull(loaded.ChestActivities);
            Assert.Equal(1L, Scalar("SELECT COUNT(*) FROM schema_migrations WHERE Module='world'"));
        }

        [MariaDbFact]
        public void MigrationDoesNotInventPermissionsForExistingLegacyGuilds()
        {
            CreateLegacyGuildTable();
            Execute("INSERT INTO guilds (Id,Name) VALUES (2,'existing')");
            Assert.Throws<InvalidOperationException>(() => GuildSchemaMigration.Apply(connection));
            Assert.Equal("existing", Scalar("SELECT Name FROM guilds WHERE Id=2"));
            Assert.Equal(0L, Scalar("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='guilds' AND COLUMN_NAME='Ranks'"));
        }

        private void CreateLegacyGuildTable() => Execute(@"CREATE TABLE guilds (
            Id BIGINT PRIMARY KEY, Name VARCHAR(255), Emblem BLOB, CreationDate MEDIUMTEXT,
            Experience BIGINT, Members BLOB, Motd BLOB) ENGINE=InnoDB");

        private void Execute(string sql)
        {
            using var command = new MySqlCommand(sql, connection);
            command.ExecuteNonQuery();
        }

        private object Scalar(string sql)
        {
            using var command = new MySqlCommand(sql, connection);
            return command.ExecuteScalar();
        }

        public void Dispose()
        {
            DatabaseManager.Instance.CloseProvider();
            using var drop = new MySqlCommand($"DROP DATABASE `{database}`", admin);
            drop.ExecuteNonQuery();
            admin.Dispose();
        }
    }

    public abstract class OrmFixtureIdentity
    {
        [Primary]
        public long Id { get; set; }
    }

    [Table("orm_fixture", false)]
    public sealed class OrmFixtureRecord : OrmFixtureIdentity, IRecord
    {
        [Column("LegacyName"), Update]
        public string Name { get; set; } = "";
        [Update]
        public int Counter { get; set; }
        [Blob, Update]
        public List<OrmPayload>? Payload { get; set; }
    }

    [ProtoContract]
    public sealed class OrmPayload
    {
        [ProtoMember(1)]
        public int Value { get; set; }
    }
}
