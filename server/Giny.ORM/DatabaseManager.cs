using Giny.Core;
using Giny.Core.DesignPattern;
using Giny.ORM.Attributes;
using Giny.ORM.Interfaces;
using Giny.ORM.IO;
using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;

namespace Giny.ORM
{
    public class DatabaseManager : Singleton<DatabaseManager>
    {
        public static object DatabaseLocker = new object();
        private long nextHealthCheck;
        private string providerConnectionString;

        public const string ConnectionString = "Server={0};Port={4};UserId={1};Password={2};Database={3}";

        private MySqlConnection ConnectionProvider
        {
            get;
            set;
        }

        public Type[] TableTypes
        {
            get;
            private set;
        }
        public event Action<string, int, int> OnTablesLoadProgress;

        public event Action<Type, string> OnStartLoadTable;

        public event Action<Type, string> OnEndLoadTable;

        public void Initialize(Assembly recordsAssembly, string host, string database, string user, string password, uint port = 3306)
        {
            this.ConnectionProvider?.Dispose();
            providerConnectionString = new MySqlConnectionStringBuilder
            {
                Server = host, Port = port, Database = database, UserID = user, Password = password,
                Pooling = true, MaximumPoolSize = 32, ConnectionReset = true
            }.ConnectionString;
            this.ConnectionProvider = new MySqlConnection(providerConnectionString);
            nextHealthCheck = 0;
            this.TableTypes = Array.FindAll(recordsAssembly.GetTypes(), x => x.GetInterface("IRecord") != null);
            TableManager.Instance.Initialize(TableTypes);
        }

        /// <summary>An operation-owned lease from the driver pool; the caller must dispose it.</summary>
        public MySqlConnection OpenConnection()
        {
            var connection = new MySqlConnection(providerConnectionString);
            try { connection.Open(); return connection; }
            catch { connection.Dispose(); throw; }
        }

        public MySqlConnection UseProvider()
        {
            return UseProvider(ConnectionProvider);
        }
        private MySqlConnection UseProvider(MySqlConnection connection)
        {
            lock (DatabaseLocker)
            {
                var now = System.Diagnostics.Stopwatch.GetTimestamp();
                if (connection.State != System.Data.ConnectionState.Open || (now >= nextHealthCheck && !connection.Ping()))
                {
                    connection.Close();
                    connection.Open();
                }

                if (now >= nextHealthCheck) nextHealthCheck = now + 30 * System.Diagnostics.Stopwatch.Frequency;
                return connection;
            }
        }
        public void Reload<T>() where T : IRecord
        {
            var type = typeof(T);
            TableManager.Instance.ClearContainer(type);

            DatabaseReader reader = new DatabaseReader(type);
            using var connection = OpenConnection();
            reader.Select(connection);
        }
        public void LoadTables()
        {
            int i = 0;

            foreach (var tableType in TableTypes)
            {
                var definition = TableManager.Instance.GetDefinition(tableType);
                var attribute = definition.TableAttribute;

                OnTablesLoadProgress?.Invoke(attribute.TableName, i, TableTypes.Length);

                if (attribute.Load)
                {
                    LoadTable(tableType);
                }
                i++;
            }
        }

        /// <summary>
        /// Registers records supplied by a runtime module and loads their static containers.
        /// The physical tables must exist before this method is called.
        /// </summary>
        public void RegisterTables(IEnumerable<Type> tableTypes, bool loadTables = true)
        {
            lock (DatabaseLocker)
            {
                var currentTypes = TableTypes ?? Array.Empty<Type>();
                var newTypes = tableTypes
                    .Where(x => typeof(IRecord).IsAssignableFrom(x))
                    .Where(x => !currentTypes.Contains(x))
                    .Distinct()
                    .ToArray();

                if (newTypes.Length == 0)
                {
                    return;
                }

                TableManager.Instance.RegisterTypes(newTypes);
                TableTypes = currentTypes.Concat(newTypes).ToArray();

                if (loadTables)
                {
                    foreach (var type in newTypes)
                    {
                        var definition = TableManager.Instance.GetDefinition(type);
                        if (definition.Load)
                        {
                            LoadTable(type);
                        }
                    }
                }
            }
        }

        /// <summary>
        /// Executes an idempotent SQL migration supplied by a module.
        /// Errors are propagated so startup cannot continue with a partial schema.
        /// </summary>
        public void ExecuteScript(string script)
        {
            lock (DatabaseLocker)
            {
                using var connection = OpenConnection();
                var migration = new MySqlScript(connection, script);
                migration.Execute();
            }
        }

        /// <summary>
        /// Executes a set of parameterized operations atomically on an operation-owned pooled connection.
        /// Runtime modules use this for state transitions that must not be partially applied.
        /// </summary>
        public T ExecuteTransaction<T>(Func<MySqlConnection, MySqlTransaction, T> operation)
        {
            using var connection = OpenConnection();
            using var transaction = connection.BeginTransaction();
            try
            {
                T result = operation(connection, transaction);
                transaction.Commit();
                return result;
            }
            catch
            {
                // Preserve the operation error even if the connection has also failed.
                try { transaction.Rollback(); } catch { }
                throw;
            }
        }
        private void LoadTable(Type type)
        {
            var reader = new DatabaseReader(type);
            var tableName = reader.TableName;
            OnStartLoadTable?.Invoke(type, tableName);
            using var connection = OpenConnection();
            reader.Select(connection);
            OnEndLoadTable?.Invoke(type, tableName);
        }
        public void LoadTable<T>() where T : IRecord
        {
            LoadTable(typeof(T));
        }
        public void CloseProvider()
        {
            this.ConnectionProvider.Close();
        }

        public void DropAllTablesIfExists()
        {
            foreach (var type in TableTypes)
            {
                var definition = TableManager.Instance.GetDefinition(type);
                TableAttribute attribute = definition.TableAttribute;
                DropTableIfExists(attribute.TableName);
            }
        }
        public void DropTableIfExists(string tableName)
        {
            Query(string.Format(QueryConstants.Drop, tableName));
        }
        public void DropTableIfExists(Type type)
        {
            var definition = TableManager.Instance.GetDefinition(type);
            DropTableIfExists(definition.TableAttribute.TableName);
        }
        public void DropTableIfExists<T>() where T : IRecord
        {
            DropTableIfExists(TableManager.Instance.GetDefinition(typeof(T)).TableAttribute.TableName);
        }
        public void Query(string query)
        {
            using var connection = OpenConnection();
            using var cmd = new MySqlCommand(query, connection);
            try { cmd.ExecuteNonQuery(); }
            catch (Exception ex) { Logger.Write("Unable to query (" + query + ")" + ex, Channels.Critical); }
        }

        public object QueryScalar(string query)
        {
            using var connection = OpenConnection();
            using var cmd = new MySqlCommand(query, connection);
            return cmd.ExecuteScalar();
        }
        public void DeleteTable<T>() where T : IRecord
        {
            var definition = TableManager.Instance.GetDefinition(typeof(T));
            DeleteTable(definition.TableAttribute.TableName);
        }
        public void DeleteTable(string tableName)
        {
            Query(string.Format(QueryConstants.Delete, tableName));
        }
        public void CreateTableIfNotExists(Type type)
        {
            var definition = TableManager.Instance.GetDefinition(type);

            string tableName = definition.TableAttribute.TableName;

            PropertyInfo primaryProperty = definition.PrimaryProperty;

            string str = string.Empty;

            foreach (var property in definition.Properties)
            {
                string pType = QueryConstants.ConvertType(property);
                str += SqlColumns.Quote(SqlColumns.Name(property)) + " " + pType + ",";
            }

            if (primaryProperty != null)
                str += string.Format(QueryConstants.PrimaryKey, SqlColumns.Quote(SqlColumns.Name(primaryProperty)));
            else
                str = str.Remove(str.Length - 1, 1);

            this.Query(string.Format(QueryConstants.Create, tableName, str));

        }
        public void CreateAllTablesIfNotExists()
        {
            foreach (var type in TableTypes)
            {
                CreateTableIfNotExists(type);
            }
        }
        public void CreateTableIfNotExists<T>() where T : IRecord
        {
            CreateTableIfNotExists(typeof(T));
        }
    }
}
