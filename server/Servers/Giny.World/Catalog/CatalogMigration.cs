using System.Collections;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using Giny.Core.IO;
using Giny.ORM;
using Giny.ORM.Attributes;
using Giny.ORM.Interfaces;
using Giny.ORM.IO;
using Giny.Protocol.Enums;
using Giny.World.Managers.Effects;
using Giny.World.Managers.Effects.Targets;
using Giny.World.Managers.Fights.Cast;
using Giny.World.Managers.Fights.Triggers;
using Giny.World.Records.Items;
using Giny.World.Records.Monsters;
using Giny.World.Records.Spells;
using MySql.Data.MySqlClient;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Giny.World.Catalog;

public static class CatalogMigration
{
    // Only static catalogues. Maps, player data, custom modules and live spawns are outside this list.
    public static readonly (string Domain, string Table, string Class)[] Mappings = {
        ("effects","effects","Effect"), ("items","items","Item"), ("items","weapons","Weapon"),
        ("itemsets","item_sets","ItemSet"), ("spellstates","spell_states","SpellState"),
        ("spelllevels","spell_levels","SpellLevel"), ("spells","spells","Spell"),
        ("spellvariants","spell_variants","SpellVariant"), ("spellbombs","spell_bombs","SpellBomb"),
        ("monsters","monsters","Monster"), ("recipes","recipes","Recipe"), ("breeds","breeds","Breed"),
        ("heads","heads","Head"), ("npcs","npcs","Npc"), ("emoticons","emotes","Emoticon"),
        ("quests","quests","Quest"), ("queststeps","quest_steps","QuestStep"),
        ("questobjectives","quest_objectives","QuestObjective"), ("queststeprewards","quest_step_rewards","QuestStepRewards"),
        ("achievements","achievements","Achievement"), ("achievementobjectives","achievement_objectives","AchievementObjective"),
        ("achievementrewards","achievement_rewards","AchievementReward"), ("ornaments","ornaments","Ornament"), ("titles","titles","Title"),
    };

    public static int Run(string[] args)
    {
        try
        {
            var options = new Dictionary<string,string>();
            for (var i=0;i<args.Length;i+=2) options.Add(args[i],args[i+1]);
            var database = options["--database"];
            if (!Regex.IsMatch(database, "^giny_catalog_stage_[a-z0-9_]+$")) throw new ArgumentException("Prepare requires a giny_catalog_stage_* copy");
            var snapshot = options["--snapshot"];
            if (!Regex.IsMatch(snapshot, "^[a-f0-9]{64}$")) throw new ArgumentException("Invalid snapshot");
            var output = Path.GetFullPath(options["--output"]);
            if (Directory.Exists(output)) throw new IOException("Output already exists");
            var flags = JObject.Parse(File.ReadAllText(options["--flags"]));
            var builder = new MySqlConnectionStringBuilder { Server="127.0.0.1", Port=3307, UserID="root",
                Password=Environment.GetEnvironmentVariable("GINY_CATALOG_DB_PASSWORD") ?? "", Database=database,
                CharacterSet="utf8mb4", AllowUserVariables=true };
            using var connection = new MySqlConnection(builder.ConnectionString); connection.Open();
            Prepare(connection, database, snapshot, flags, output);
            return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }

    static JObject ReadDocument(MySqlConnection connection, string snapshot, string path)
    {
        using var command = new MySqlCommand("SELECT payload FROM giny_catalog.catalog_documents WHERE snapshot=@snapshot AND path=@path", connection);
        command.Parameters.AddWithValue("@snapshot",snapshot); command.Parameters.AddWithValue("@path",path);
        var bytes = (byte[]?)command.ExecuteScalar() ?? throw new InvalidDataException($"Missing archive document {path}");
        using var gzip = new GZipStream(new MemoryStream(bytes), CompressionMode.Decompress);
        using var reader = new StreamReader(gzip); return JObject.Parse(reader.ReadToEnd());
    }

    static void Prepare(MySqlConnection connection, string database, string snapshot, JObject flags, string output)
    {
        JObject manifest;
        using (var command = new MySqlCommand("SELECT manifest FROM giny_catalog.catalog_builds WHERE snapshot=@snapshot AND status='ready'", connection))
        {
            command.Parameters.AddWithValue("@snapshot",snapshot);
            manifest = JObject.Parse((string?)command.ExecuteScalar() ?? throw new InvalidDataException("Source release is not ready"));
        }
        if ((string?)manifest["clientVersion"] != (string?)flags["clientVersion"]) throw new InvalidDataException("Flags/source build mismatch");
        var tables = new Dictionary<string,JObject>();
        using (var command = new MySqlCommand("SELECT domain,record_id,payload FROM giny_catalog.catalog_records WHERE snapshot=@snapshot ORDER BY domain,record_id",connection))
        {
            command.Parameters.AddWithValue("@snapshot",snapshot);
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                var domain=reader.GetString(0); if (!tables.ContainsKey(domain)) tables[domain]=new JObject();
                tables[domain][reader.GetString(1)] = JObject.Parse(reader.GetString(2));
            }
        }
        var locale = ReadDocument(connection,snapshot,"i18n/fr.json.gz");
        var adapter = new OfficialRecordAdapter((JObject)locale["by_id"]!, (JObject)flags["classes"]!);
        var recordTypes = typeof(ItemRecord).Assembly.GetTypes().Where(t=>typeof(IRecord).IsAssignableFrom(t) && t.GetCustomAttribute<TableAttribute>()!=null).ToDictionary(t=>t.GetCustomAttribute<TableAttribute>()!.TableName);
        DatabaseManager.Instance.Initialize(typeof(ItemRecord).Assembly, "127.0.0.1",database,"root",Environment.GetEnvironmentVariable("GINY_CATALOG_DB_PASSWORD") ?? "",3307);
        var records = new Dictionary<string,Dictionary<long,IRecord>>();
        var statuses = new Dictionary<(string,long),List<string>>();
        var imported = new Dictionary<string,int>();
        var adapted = new HashSet<(string,long)>();
        foreach (var mapping in Mappings)
        {
            var type=recordTypes[mapping.Table];
            new DatabaseReader(type).Select(DatabaseManager.Instance.UseProvider());
            var container=TableManager.Instance.GetDefinition(type).ContainerValue;
            records[mapping.Table]=container.Keys.Cast<long>().ToDictionary(id=>id,id=>(IRecord)container[id]!);
            imported[mapping.Table]=0;
            var itemTypes = mapping.Domain == "items" ? ReadDocument(connection,snapshot,"types/items.json.gz") : null;
            foreach (var entry in tables[mapping.Domain].Properties())
            {
                if (itemTypes != null && (string?)itemTypes[entry.Name]?["class"] != mapping.Class+"Data") continue;
                var id=long.Parse(entry.Name); var key=(mapping.Domain,id);
                if (!statuses.ContainsKey(key)) statuses[key]=new List<string>();
                try
                {
                    // Giny's current inventory protocol transmits signed short template IDs.
                    if (mapping.Domain is "items" or "monsters" or "spells" && id>short.MaxValue)
                        throw new InvalidDataException("Template ID exceeds signed 16-bit protocol");
                    var source=(JObject)entry.Value;
                    records[mapping.Table].TryGetValue(id,out var previous);
                    var record=adapter.Adapt(type,source,mapping.Class,previous);
                    records[mapping.Table][id]=record;
                    adapted.Add((mapping.Table,id)); imported[mapping.Table]++;
                    if (record is SpellLevelRecord level) statuses[key].AddRange(SpellReasons(level,source));
                    if (record is MonsterRecord monster)
                    {
                        if (monster.Grades.Count==0) statuses[key].Add("No monster grade");
                        if (source["spellGrades"] is JArray grades && grades.Count>0 && grades.Count!=monster.Spells.Length)
                            statuses[key].Add("Per-spell grade layout is unsupported");
                        // Normal Giny encounters select an explicit official grade. scaleGradeRef is
                        // only needed when synthesizing other levels; no such scaling is requested here.
                        // Conditional global/event drops stay archived; they are not awarded as unconditional loot.
                        for(var index=0;index<monster.Grades.Count;index++)
                        {
                            var starting=(int?)source["grades"]?[index]?["startingSpellId"] ?? 0;
                            if(starting!=0 && !tables["spelllevels"].ContainsKey(starting.ToString()))
                                statuses[key].Add($"Missing starting spell level {starting}");
                        }
                    }
                }
                catch(Exception error) { statuses[key].Add("Adaptation: "+(error.InnerException?.Message ?? error.Message)); }
            }
            Console.WriteLine($"Adapt {mapping.Table}: {imported[mapping.Table]} / {tables[mapping.Domain].Count}");
        }
        // Some IDs changed item subclass between releases. Inventory and weapon lookups must agree.
        foreach (var pair in records["weapons"].Where(p=>adapted.Contains(("weapons",p.Key))))
        {
            records["items"][pair.Key]=((WeaponRecord)pair.Value).ToItemRecord();
            adapted.Add(("items",pair.Key));
        }
        // Resolve all dependency failures before writing any catalogue rows.
        Propagate(tables,records,statuses);
        using(var schema=new MySqlCommand(@"CREATE TABLE IF NOT EXISTS catalog_runtime_status (
          Domain varchar(64) NOT NULL, RecordId bigint NOT NULL, Available tinyint NOT NULL,
          Reasons mediumtext NOT NULL, Snapshot char(64) NOT NULL, PRIMARY KEY(Domain,RecordId)
        ) ENGINE=InnoDB",connection)) schema.ExecuteNonQuery();
        foreach(var mapping in Mappings)
        {
            // On the staging copy only: allow a single rollbackable import and large effect collections.
            using var alter=new MySqlCommand($"ALTER TABLE `{mapping.Table}` ENGINE=InnoDB",connection); alter.ExecuteNonQuery();
            var props=DatabaseWriter.GetAddProperties(recordTypes[mapping.Table]);
            foreach(var prop in props.Where(p=>p.GetCustomAttribute<BlobAttribute>()!=null || p.PropertyType==typeof(string)))
            {
                var sqlType=prop.GetCustomAttribute<BlobAttribute>()!=null ? "LONGBLOB" : "LONGTEXT";
                using var column=new MySqlCommand($"ALTER TABLE `{mapping.Table}` MODIFY `{SqlColumns.Name(prop)}` {sqlType} NULL",connection); column.ExecuteNonQuery();
            }
        }
        using(var transaction=connection.BeginTransaction())
        {
            foreach(var mapping in Mappings)
            {
                var props=DatabaseWriter.GetAddProperties(recordTypes[mapping.Table]);
                var columns=props.Select(p=>SqlColumns.Quote(SqlColumns.Name(p))).ToArray();
                var placeholders=Enumerable.Range(0,props.Length).Select(i=>"@p"+i).ToArray();
                using var command=new MySqlCommand($"INSERT INTO `{mapping.Table}` ({string.Join(',',columns)}) VALUES ({string.Join(',',placeholders)}) ON DUPLICATE KEY UPDATE {string.Join(',',columns.Select(c=>$"{c}=VALUES({c})"))}",connection,transaction);
                for(var i=0;i<props.Length;i++) command.Parameters.Add(new MySqlParameter(placeholders[i],null));
                foreach(var pair in records[mapping.Table].Where(p=>adapted.Contains((mapping.Table,p.Key))))
                {
                    for(var i=0;i<props.Length;i++) command.Parameters[i].Value=DatabaseWriter.ConvertObject(props[i],pair.Value) ?? DBNull.Value;
                    command.ExecuteNonQuery();
                }
            }
            using(var clear=new MySqlCommand("DELETE FROM catalog_runtime_status",connection,transaction)) clear.ExecuteNonQuery();
            using var status=new MySqlCommand("INSERT INTO catalog_runtime_status VALUES (@domain,@id,@available,@reasons,@snapshot)",connection,transaction);
            status.Parameters.Add("@domain",MySqlDbType.VarChar);status.Parameters.Add("@id",MySqlDbType.Int64);status.Parameters.Add("@available",MySqlDbType.Byte);status.Parameters.Add("@reasons",MySqlDbType.LongText);status.Parameters.AddWithValue("@snapshot",snapshot);
            foreach(var pair in statuses)
            {
                status.Parameters[0].Value=pair.Key.Item1;status.Parameters[1].Value=pair.Key.Item2;
                status.Parameters[2].Value=pair.Value.Count==0;status.Parameters[3].Value=string.Join("; ",pair.Value.Distinct());status.ExecuteNonQuery();
            }
            transaction.Commit();
        }
        // Re-read serialized rows using Giny's reader before exporting or declaring preparation successful.
        foreach(var mapping in Mappings)
        {
            var type=recordTypes[mapping.Table]; TableManager.Instance.ClearContainer(type);
            new DatabaseReader(type).Select(DatabaseManager.Instance.UseProvider());
            var container=TableManager.Instance.GetDefinition(type).ContainerValue;
            foreach(var pair in records[mapping.Table].Where(p=>adapted.Contains((mapping.Table,p.Key))))
            {
                var stored=(IRecord)container[pair.Key]!;
                foreach(var prop in DatabaseWriter.GetAddProperties(type))
                {
                    var expected=DatabaseWriter.ConvertObject(prop,pair.Value);var actual=DatabaseWriter.ConvertObject(prop,stored);
                    if(expected is byte[] a && actual is byte[] b ? !a.SequenceEqual(b) : !Equals(expected,actual))
                        throw new InvalidDataException($"Roundtrip mismatch {mapping.Table}/{pair.Key}/{prop.Name}");
                }
            }
        }
        Directory.CreateDirectory(output);
        foreach(var pair in tables)
        {
            var domain=pair.Key;
            foreach(var entry in pair.Value.Properties())
            {
                var id=long.Parse(entry.Name);
                if(statuses.TryGetValue((domain,id),out var reasons))
                {
                    entry.Value["runtimeAvailable"]=reasons.Count==0;
                    entry.Value["runtimeUnavailableReasons"]=JArray.FromObject(reasons.Distinct());
                }
                var map=Mappings.FirstOrDefault(m=>m.Domain==domain && adapted.Contains((m.Table,id)));
                if(map.Table!=null)
                {
                    var expanded=adapter.Expand((JObject)entry.Value,map.Class);
                    var record=(IRecord)TableManager.Instance.GetDefinition(recordTypes[map.Table]).ContainerValue[id]!;
                    foreach(var prop in DatabaseWriter.GetAddProperties(record.GetType()))
                    {
                        var field=prop.GetCustomAttribute<Giny.IO.D2O.D2OFieldAttribute>();
                        if(field==null)continue;
                        if(prop.GetCustomAttribute<Giny.IO.D2O.I18NFieldAttribute>()!=null)
                            expanded[prop.Name.ToLowerInvariant()]=JToken.FromObject(prop.GetValue(record) ?? "");
                        else if(prop.PropertyType.IsPrimitive || prop.PropertyType==typeof(string))
                            expanded[field.FieldName]=JToken.FromObject(prop.GetValue(record) ?? "");
                    }
                    entry.Value=expanded;
                }
            }
            WriteGzip(Path.Combine(output,"data",domain+".json.gz"),pair.Value);
        }
        WriteGzip(Path.Combine(output,"client/i18n.json.gz"),locale);
        var hashes=Directory.GetFiles(output,"*.gz",SearchOption.AllDirectories).OrderBy(p=>p).ToDictionary(
            p=>Path.GetRelativePath(output,p).Replace('\\','/'),
            p=>Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(File.ReadAllBytes(p))).ToLowerInvariant());
        var catalogVersion=Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(hashes)))).ToLowerInvariant();
        var report=new JObject { ["format"]="giny.runtime-catalog.v1",["snapshot"]=snapshot,["clientVersion"]=manifest["clientVersion"],
            ["sourceDatabase"]=database,["origin"]="giny-sql",["catalogVersion"]=catalogVersion,["files"]=JObject.FromObject(hashes),["imported"]=JObject.FromObject(imported),
            ["unavailableCounts"]=JObject.FromObject(statuses.Where(p=>p.Value.Count>0).GroupBy(p=>p.Key.Item1).ToDictionary(g=>g.Key,g=>g.Count())),
            ["unavailable"]=new JArray(statuses.Where(p=>p.Value.Count>0).Select(p=>new JObject{["domain"]=p.Key.Item1,["id"]=p.Key.Item2,["reasons"]=JArray.FromObject(p.Value.Distinct())})),
            ["flagsEvidence"]=flags,["tables"]=new JArray(Mappings.Select(m=>m.Table).Concat(new[]{"catalog_runtime_status","catalog_runtime_release"})) };
        
        using(var releaseSchema=new MySqlCommand("CREATE TABLE IF NOT EXISTS catalog_runtime_release (Id int PRIMARY KEY, Snapshot char(64) NOT NULL, CatalogVersion char(64) NOT NULL) ENGINE=InnoDB",connection))releaseSchema.ExecuteNonQuery();
        using(var release=new MySqlCommand("REPLACE INTO catalog_runtime_release VALUES (1,@snapshot,@version)",connection))
        {
            release.Parameters.AddWithValue("@snapshot",snapshot);release.Parameters.AddWithValue("@version",catalogVersion);release.ExecuteNonQuery();
        }
        var checksums = new JObject();
        foreach(var table in report["tables"]!.Values<string>())
        {
            using var checksum = new MySqlCommand($"CHECKSUM TABLE `{table}`", connection);
            using var reader = checksum.ExecuteReader(); reader.Read();
            if(reader.IsDBNull(1)) throw new InvalidDataException($"Cannot checksum {table}");
            checksums[table!] = reader.GetValue(1).ToString();
        }
        report["sqlChecksums"] = checksums;
        File.WriteAllText(Path.Combine(output,"manifest.json"),report.ToString(Formatting.None));
        Console.WriteLine(report["imported"]);Console.WriteLine(report["unavailableCounts"]);
    }

    static readonly HashSet<EffectsEnum> HandledEffects=typeof(ItemRecord).Assembly.GetTypes().SelectMany(t=>t.GetCustomAttributes<SpellEffectHandlerAttribute>()).Select(a=>a.Effect).ToHashSet();
    public static List<string> SpellReasons(SpellLevelRecord level,JObject source)
    {
        var reasons=new List<string>();
        foreach(var effect in level.Effects.Concat(level.CriticalEffects))
        {
            if(!HandledEffects.Contains(effect.EffectEnum)) reasons.Add($"Unsupported effect {effect.EffectId}");
            if(effect.Triggers.Any(t=>t.Type==TriggerTypeEnum.Unknown))reasons.Add("Unsupported effect trigger "+effect.RawTriggers);
            if(effect.GetTargets().Any(t=>t is Giny.World.Managers.Effects.Targets.UnknownCriterion))reasons.Add("Unsupported target mask "+effect.TargetMask);
            if(effect.RawZone.Length>0 && !";XLlTDCIOQGVW+#*/UAaP-".Contains(effect.RawZone[0]))reasons.Add("Unsupported zone "+effect.RawZone[0]);
        }
        foreach(var field in new[]{"maxGlobalCastPerTurn","maxGlobalCastPerTarget"}) if((int?)source[field]>0)reasons.Add("Unsupported "+field);
        var flags=(long?)source["m_flags"] ?? 0;
        if((flags & (1<<10 | 1<<11 | 1<<12 | 1<<13))!=0)reasons.Add("Additional casting constraints require engine support");
        foreach(JObject effect in source["effects"]!.Concat(source["criticalEffect"]!))
        {
            if((int?)effect["zoneDescr"]?["forcedDirection"]!=0 || (int?)effect["zoneDescr"]?["onlyAffectIfInSightLine"]==1)
                reasons.Add("Directional/line-of-sight effect zone requires engine support");
            if((int?)effect["effectTriggerDuration"]>0) reasons.Add("Effect trigger duration requires engine support");
        }
        return reasons.Distinct().ToList();
    }

    static void Propagate(Dictionary<string,JObject> data,Dictionary<string,Dictionary<long,IRecord>> records,Dictionary<(string,long),List<string>> statuses)
    {
        bool Bad(string domain,long id)=>!data[domain].ContainsKey(id.ToString()) || (statuses.TryGetValue((domain,id),out var reasons)&&reasons.Count>0);
        void Block(string domain,long id,string reason) { if(!statuses.ContainsKey((domain,id)))statuses[(domain,id)]=new(); if(!statuses[(domain,id)].Contains(reason))statuses[(domain,id)].Add(reason); }
        for(var pass=0;pass<100;pass++)
        {
            var before=statuses.Count(p=>p.Value.Count>0);
            foreach(var entry in data["spells"].Properties())
                if(entry.Value["spellLevels"]!.Values<long>().Any(id=>Bad("spelllevels",id)))Block("spells",long.Parse(entry.Name),"Unavailable spell level");
            foreach(var entry in data["spelllevels"].Properties())
            {
                var id=long.Parse(entry.Name);
                if(!records["spell_levels"].TryGetValue(id,out var record))continue;
                var level=(SpellLevelRecord)record;
                if(Bad("spells",level.SpellId))Block("spelllevels",id,"Unavailable owning spell");
                foreach(var effect in level.Effects.Concat(level.CriticalEffects).OfType<EffectDice>())
                {
                    if(effect.IsSpellCastEffect() && effect.Min>0 && Bad("spells",effect.Min))Block("spelllevels",id,$"Unavailable triggered spell {effect.Min}");
                    if(effect.EffectEnum is EffectsEnum.Effect_Summon or EffectsEnum.Effect_SummonSlave or EffectsEnum.Effect_SummonsBomb or EffectsEnum.Effect_KillAndSummon or EffectsEnum.Effect_KillAndSummonSlave)
                        if(effect.Min>0 && Bad("monsters",effect.Min))Block("spelllevels",id,$"Unavailable summon {effect.Min}");
                }
            }
            foreach(var entry in data["monsters"].Properties())
            {
                if(entry.Value["spells"]!.Values<long>().Any(id=>id>0 && Bad("spells",id)))Block("monsters",long.Parse(entry.Name),"Unavailable monster spell");
                if(entry.Value["grades"]!.Any(g=>(long?)g["startingSpellId"]>0 && Bad("spelllevels",(long)g["startingSpellId"]!)))
                    Block("monsters",long.Parse(entry.Name),"Unavailable starting spell level");
            }
            foreach(var entry in data["recipes"].Properties())
                if(Bad("items",(long)entry.Value["resultId"]!) || entry.Value["ingredientIds"]!.Values<long>().Any(id=>Bad("items",id)))Block("recipes",long.Parse(entry.Name),"Unavailable recipe item");
            if(statuses.Count(p=>p.Value.Count>0)==before)break;
            if(pass==99)throw new InvalidDataException("Dependency closure did not converge");
        }
    }
    static void WriteGzip(string path,JToken value)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        using var stream=new GZipStream(File.Create(path),CompressionLevel.Optimal);
        using var writer=new StreamWriter(stream,new UTF8Encoding(false));writer.Write(value.ToString(Formatting.None));
    }
}
