using System.Collections;
using System.Reflection;
using Giny.IO.D2O;
using Giny.ORM.Attributes;
using Giny.ORM.Interfaces;
using Giny.ORM.IO;
using Giny.World.Managers.Effects;
using Giny.World.Managers.Entities.Look;
using Giny.World.Records.Breeds;
using Giny.World.Records.Monsters;
using Giny.World.Records.Quests;
using Newtonsoft.Json.Linq;

namespace Giny.World.Catalog;

/// <summary>Explicit Unity -> Giny conversion. Unknown/overflowing values reject a record.</summary>
public sealed class OfficialRecordAdapter
{
    readonly JObject names;
    readonly JObject flags;
    public OfficialRecordAdapter(JObject names, JObject flags) { this.names = names; this.flags = flags; }

    public JObject Expand(JObject source, string className)
    {
        var result = (JObject)source.DeepClone();
        var flagClass = className == "Weapon" ? "ItemData" : className + "Data";
        if (result["m_flags"] != null && flags[flagClass] is JObject definitions)
            foreach (var property in definitions.Properties())
                result[property.Name] = ((long)result["m_flags"]! & (long)property.Value["mask"]!) != 0;
        if (result["criterions"] != null) result["criteria"] = result["criterions"]!.DeepClone();
        // Cursed was removed from ItemData and has no remaining gameplay consumer in Giny.
        if (className is "Item" or "Weapon") result["cursed"] = false;
        return result;
    }

    public IRecord Adapt(Type type, JObject source, string className, IRecord? previous = null)
    {
        var data = Expand(source, className);
        var record = (IRecord)Activator.CreateInstance(type)!;
        foreach (var property in DatabaseWriter.GetAddProperties(type))
        {
            if (!property.CanWrite) continue;
            if (previous != null) property.SetValue(record, property.GetValue(previous));
            var field = property.GetCustomAttribute<D2OFieldAttribute>();
            if (field == null)
            {
                // Local/server-only settings survive updates. New text fields have no official equivalent.
                if (previous == null && property.PropertyType == typeof(string)) property.SetValue(record, "");
                continue;
            }
            var name = property.Name == "FemaleColors" ? "femaleColors" : field.FieldName;
            if (!data.TryGetValue(name, out var token)) throw new InvalidDataException($"Missing field {className}.{name}");
            object? value;
            if (property.GetCustomAttribute<I18NFieldAttribute>() != null)
            {
                var key = token.ToString();
                value = names[key]?.ToString() ?? (key == "0" || key == "-1" ? "" : throw new InvalidDataException($"Missing translation {key}"));
            }
            else value = ConvertToken(token, property.PropertyType);
            property.SetValue(record, value);
        }
        return record;
    }

    public object ConvertToken(JToken token, Type type)
    {
        if (type == typeof(EffectCollection)) return ConvertEffects(token);
        if (type == typeof(ServerEntityLook)) return EntityLookManager.Instance.Parse(token.ToString()) ?? throw new InvalidDataException("Empty entity look");
        if (type == typeof(bool))
        {
            if (token.Type == JTokenType.Boolean) return (bool)token;
            var number = (int)token;
            if (number is not (0 or 1)) throw new InvalidDataException($"Invalid boolean {number}");
            return number == 1;
        }
        if (type.IsEnum) return Enum.ToObject(type, ConvertToken(token, Enum.GetUnderlyingType(type)));
        if (type == typeof(string)) return token.Type == JTokenType.Null ? "" : token.ToString();
        if (type == typeof(StatUpgradeCost))
        {
            var values = (JArray)(token["values"] ?? token);
            return new StatUpgradeCost(checked((short)(int)values[0]), checked((short)(int)values[1]));
        }
        if (type == typeof(ItemWithQuantity))
        {
            var values = (JArray)(token["values"] ?? token);
            return new ItemWithQuantity(checked((short)(int)values[0]), (int)values[1]);
        }
        if (type.IsArray || (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(List<>)))
        {
            var elementType = type.IsArray ? type.GetElementType()! : type.GenericTypeArguments[0];
            var values = (JArray)(token is JObject obj && obj["values"] != null ? obj["values"]! : token);
            var list = (IList)Activator.CreateInstance(typeof(List<>).MakeGenericType(elementType))!;
            foreach (var child in values) list.Add(ConvertToken(child, elementType));
            if (!type.IsArray) return list;
            var array = Array.CreateInstance(elementType, list.Count); list.CopyTo(array, 0); return array;
        }
        if (token is JObject document)
        {
            var mapped = (JObject)document.DeepClone();
            if (type == typeof(MonsterGrade))
            {
                mapped["gradeId"] = mapped["grade"];
                mapped["apDodge"] = mapped["paDodge"];
                mapped["mpDodge"] = mapped["pmDodge"];
                // Despite its name, this field references the SpellLevel catalogue.
                mapped["startingSpellLevelId"] = mapped["startingSpellId"] ?? 0;
                mapped["hiddenLevel"] = mapped["level"];
            }
            if (type == typeof(MonsterDrop))
            {
                mapped["itemGId"] = mapped["objectId"];
                mapped["dropLimit"] = mapped["count"];
                mapped["criteria"] = mapped["criterions"];
                mapped["hasCriteria"] = mapped["hasCriterions"];
            }
            var result = Activator.CreateInstance(type)!;
            foreach (var property in type.GetProperties().Where(p => p.CanWrite))
                if (mapped.TryGetValue(property.Name, StringComparison.OrdinalIgnoreCase, out var child))
                    property.SetValue(result, ConvertToken(child, property.PropertyType));
            return result;
        }
        // Json.NET performs checked conversion to short/byte; overflow must never wrap an ID.
        return token.ToObject(type)!;
    }

    public EffectCollection ConvertEffects(JToken token)
    {
        var effects = new EffectCollection();
        foreach (JObject raw in (JArray)(token is JObject obj ? obj["values"]! : token))
        {
            var data = Expand(raw, "EffectInstance");
            if ((bool?)data["forClientOnly"] == true) continue;
            if (data["diceNum"] == null && data["value"] == null)
                throw new InvalidDataException("Non-numeric effect requires a dedicated serializer");
            var effect = new EffectDice(checked((short)(int)data["effectId"]!),
                (int?)data["diceNum"] ?? 0, (int?)data["diceSide"] ?? 0, (int?)data["value"] ?? 0)
            {
                Order = (int?)data["order"] ?? 0, TargetId = (int?)data["targetId"] ?? 0,
                TargetMask = (string?)data["targetMask"] ?? "", Duration = (int?)data["duration"] ?? 0,
                Delay = (int?)data["delay"] ?? 0, Random = (double?)data["random"] ?? 0,
                Group = (int?)data["group"] ?? 0, Modificator = (int?)data["modificator"] ?? 0,
                Trigger = (bool?)data["trigger"] ?? false, RawTriggers = (string?)data["triggers"] ?? "",
                Dispellable = (int?)data["dispellable"] ?? 1,
                RawZone = ConvertZone((JObject?)data["zoneDescr"]),
                IncludeCarried = (int?)data["zoneDescr"]?["includeCarried"] == 1,
            };
            effects.Add(effect);
        }
        return effects;
    }

    public static string ConvertZone(JObject? zone)
    {
        if (zone == null) return "P0";
        var shape = (char)((int?)zone["shape"] ?? 0);
        if (shape == 0) return "P0";
        if (shape == ';') return ";" + string.Join(',', zone["cellIds"]!.Values<int>());
        // Four explicit parameters avoid the ambiguous legacy three-parameter form.
        var size = checked((byte)((int?)zone["param1"] ?? 0));
        var minimum = checked((byte)((int?)zone["param2"] ?? 0));
        var decrease = checked((byte)((int?)zone["damageDecreaseStepPercent"] ?? 10));
        var maximum = checked((byte)((int?)zone["maxDamageDecreaseApplyCount"] ?? 4));
        return $"{shape}{size},{minimum},{decrease},{maximum},{(int?)zone["isStopAtTarget"] ?? 0}";
    }
}
