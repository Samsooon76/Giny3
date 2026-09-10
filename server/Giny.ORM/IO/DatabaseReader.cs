using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using Giny.ORM.Interfaces;
using Giny.ORM.Attributes;
using Giny;
using Giny.Core;
using System.Globalization;
using System.Collections;
using System.Linq.Expressions;
using Giny.ORM.Expressions;
using System.Diagnostics;
using Giny.Core.IO;

namespace Giny.ORM.IO
{
    public class DatabaseReader
    {

        public string TableName
        {
            get;
            private set;
        }
        public IDictionary Elements
        {
            get;
            set;
        }
        private PropertyInfo[] Properties
        {
            get;
            set;
        }
        private Type Type
        {
            get;
            set;
        }
        public DatabaseReader(Type type)
        {
            this.Type = type;
            var definition = TableManager.Instance.GetDefinition(type);
            this.Properties = definition.Properties;
            this.TableName = definition.TableAttribute.TableName;
            this.Elements = definition.TableAttribute.Load ? definition.ContainerValue : new Dictionary<long, IRecord>();
        }
        private string SelectSql => string.Format(QueryConstants.Select, TableName, SqlColumns.List(Properties));

        private string SelectWhereSql(string condition) =>
            string.Format(QueryConstants.SelectWhere, TableName, condition, SqlColumns.List(Properties));

        public IRecord ReadFirst(MySqlConnection connection, string where) =>
            ReadFirst(connection, where, Array.Empty<MySqlParameter>());

        private IRecord ReadFirst(MySqlConnection connection, string where, params MySqlParameter[] parameters)
        {
            lock (connection)
            {
                using var command = new MySqlCommand(SelectWhereSql(where), connection);
                command.Parameters.AddRange(parameters);
                try
                {
                    using var reader = command.ExecuteReader();
                    return reader.Read() ? ReadRecord(reader) : null;
                }
                catch (Exception ex)
                {
                    // A missing account is null; a broken schema is an error, never a missing account.
                    throw new InvalidOperationException($"Unable to read table '{TableName}'. Check its schema and migrations.", ex);
                }
            }
        }

        private IRecord ReadRecord(MySqlDataReader reader)
        {
            var record = (IRecord)Activator.CreateInstance(Type);
            for (int i = 0; i < Properties.Length; i++)
                Properties[i].SetValue(record, ConvertObject(reader[i], Properties[i]));
            return record;
        }

        private void Select(MySqlConnection connection, string sql, params MySqlParameter[] parameters)
        {
            lock (connection)
            {
                using var command = new MySqlCommand(sql, connection);
                command.Parameters.AddRange(parameters);
                // Build separately so a conversion error does not leave a partially loaded container.
                var records = new Dictionary<long, IRecord>();
                try
                {
                    using var reader = command.ExecuteReader();
                    while (reader.Read())
                    {
                        var record = ReadRecord(reader);
                        records.Add(record.Id, record);
                    }
                }
                catch (Exception ex)
                {
                    // Never DROP/recreate a populated table in response to a read failure.
                    throw new InvalidOperationException($"Unable to load table '{TableName}'. Check its schema and migrations; no data was changed.", ex);
                }
                lock (Elements)
                    foreach (var pair in records) Elements.Add(pair.Key, pair.Value);
            }
        }

        public void Select(MySqlConnection connection) => Select(connection, SelectSql);

        public void Read(MySqlConnection connection, string condition) =>
            Select(connection, SelectWhereSql(condition));

        public long Count(MySqlConnection connection)
        {
            lock (connection)
            {
                using var command = new MySqlCommand(string.Format(QueryConstants.Count, TableName), connection);
                return (long)command.ExecuteScalar();
            }
        }
        /* Maybe store all properties info instead of calling .NET reflection methods? */
        private object ConvertObject(object obj, PropertyInfo property)
        {
            Type nullableType = Nullable.GetUnderlyingType(property.PropertyType);

            if (obj is DBNull && nullableType != null)
            {
                return null;
            }

            if (nullableType != null)
            {
                return Convert.ChangeType(obj, nullableType, CultureInfo.InvariantCulture);
            }

            MethodInfo deserializationMethod = TableManager.Instance.GetDeserializationMethods(property.PropertyType);

            if (property.PropertyType.BaseType == typeof(Enum))
            {
                return Enum.Parse(property.PropertyType, obj.ToString());
            }
            else if (property.CustomAttributes.Count() > 0 && property.GetCustomAttribute<BlobAttribute>() != null)
            {
                if (obj is DBNull)
                {
                    return null;
                }
                return Protobuf.Deserialize((byte[])obj, property.PropertyType);
            }
            else if (deserializationMethod != null)
            {
                return deserializationMethod.Invoke(null, new object[] { obj is DBNull ? null : obj });
            }
            else if (property.PropertyType.IsGenericType)
            {
                if (property.PropertyType.GetGenericTypeDefinition() == typeof(List<>))
                {
                    var genericType = property.PropertyType.GetGenericArguments()[0];
                    var newList = (IList)Activator.CreateInstance(typeof(List<>).MakeGenericType(genericType));

                    var split = obj.ToString().Split(new char[] { ',' }, StringSplitOptions.RemoveEmptyEntries).ToList();

                    foreach (var element in split)
                    {
                        newList.Add(Convert.ChangeType(element, genericType, CultureInfo.InvariantCulture));
                    }
                    return newList;
                }
            }
            else if (property.PropertyType == typeof(bool))
            {
                return Convert.ToBoolean(Convert.ToByte(obj));
            }
            try
            {
                return Convert.ChangeType(obj, property.PropertyType, CultureInfo.InvariantCulture);
            }
            catch
            {
                string exception = string.Format("Unknown constructor for '{0}', ({1}).", property.PropertyType.Name, property.Name);
                throw new Exception(exception);
            }
        }
        private static IDictionary Select(Type type)
        {
            DatabaseReader reader = new DatabaseReader(type);
            using var connection = DatabaseManager.Instance.OpenConnection();
            reader.Select(connection);
            return reader.Elements;
        }
        public static IEnumerable<T> Select<T>() where T : IRecord
        {
            return Select(typeof(T)).Values.Cast<T>();
        }
        public static IEnumerable<T> Select<T>(string fieldName, object fieldValue) where T : IRecord
        {
            var type = typeof(T);
            DatabaseReader reader = new DatabaseReader(type);
            using var connection = DatabaseManager.Instance.OpenConnection();
            reader.Select(connection,
                reader.SelectWhereSql(SqlColumns.Field(reader.Properties, fieldName) + "=@value"),
                new MySqlParameter("@value", fieldValue ?? DBNull.Value));
            return reader.Elements.Values.Cast<T>();
        }
        public static T ReadFirst<T>(string fieldName, string fieldValue) where T : IRecord
        {
            DatabaseReader reader = new DatabaseReader(typeof(T));
            using var connection = DatabaseManager.Instance.OpenConnection();
            return (T)reader.ReadFirst(connection,
                SqlColumns.Field(reader.Properties, fieldName) + "=@value",
                new MySqlParameter("@value", fieldValue ?? (object)DBNull.Value));
        }
        public static long Count<T>()
        {
            DatabaseReader reader = new DatabaseReader(typeof(T));
            using var connection = DatabaseManager.Instance.OpenConnection();
            return reader.Count(connection);
        }
    }
}
