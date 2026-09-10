using System.Collections;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text.Json;
using Giny.Core.Network.Messages;
using Giny.Protocol.Custom.Enums;
using Giny.Protocol.Messages;
using Giny.Protocol.Types;
using Giny.World.Network;
using Giny.World.Records.Challenges;

namespace Giny.World.Managers.Modern;

/// <summary>Projects the recipient's protocol messages, never unfiltered engine objects.</summary>
public static class ModernCombatEvents
{
    /// <summary>Version of the modern-only enrichment keys merged into the JSON
    /// projection (resource/reason/metaVersion). The legacy wire is untouched.</summary>
    public const int MetaVersion = 1;

    /// <summary>Modern-only enrichment attached at the emission point that knows
    /// the resource. It is keyed by message instance, never serialized on the
    /// legacy wire, and only merged into the modern JSON projection.
    /// Never reconstruct the resource from context after the fact.</summary>
    private static readonly ConditionalWeakTable<NetworkMessage, Dictionary<string, object?>> Meta = new();

    public static void TagPointsVariation(GameActionFightPointsVariationMessage message, string resource, string reason)
    {
        var meta = Meta.GetOrCreateValue(message);
        meta["resource"] = resource;
        meta["reason"] = reason;
    }

    /// <summary>Authoritative resource ("ap" or "mp") for a points-variation
    /// message. Emission metadata wins; well-known protocol actionIds from
    /// ActionsEnum follow; anything else (including a bare actionId 0 without
    /// metadata) returns null so the client awaits the snapshot instead of
    /// guessing the resource from graphical context.</summary>
    public static string? ResolveResource(short actionId, string? metaResource)
    {
        if (!string.IsNullOrEmpty(metaResource))
            return metaResource;
        return actionId switch
        {
            (short)ActionsEnum.ACTION_CHARACTER_ACTION_POINTS_LOST => "ap",
            (short)ActionsEnum.ACTION_CHARACTER_ACTION_POINTS_LOST_CASTER => "ap",
            (short)ActionsEnum.ACTION_CHARACTER_ACTION_POINTS_WIN => "ap",
            (short)ActionsEnum.ACTION_CHARACTER_MOVEMENT_POINTS_LOST => "mp",
            (short)ActionsEnum.ACTION_CHARACTER_MOVEMENT_POINTS_LOST_CASTER => "mp",
            (short)ActionsEnum.ACTION_CHARACTER_MOVEMENT_POINTS_WIN => "mp",
            _ => null,
        };
    }
    public static bool IsCombatMessage(NetworkMessage message) =>
        message.GetType().Name.StartsWith("GameFight") ||
        message.GetType().Name.StartsWith("GameActionFight") ||
        message.GetType().Name.StartsWith("Challenge") ||
        message is SequenceStartMessage or SequenceEndMessage or GameEntitiesDispositionMessage
            or GameEntityDispositionMessage or GameMapMovementMessage or GameContextDestroyMessage
            or GameContextCreateMessage or GameContextRemoveElementMessage or GameContextRemoveMultipleElementsMessage;

    // Serialize runtime fields recursively: System.Text.Json's declared-base array serialization
    // otherwise discards player rewards and derived spell/effect data in this net6 protocol.
    public static object? ProtocolValue(object? value)
    {
        if (value == null) return null;
        var type = value.GetType();
        if (value is string or bool) return value;
        if (value is long or ulong) return value.ToString(); // XP remains exact in JavaScript.
        if (type.IsEnum) return Convert.ToInt32(value);
        if (type.IsPrimitive || value is decimal) return value;
        if (value is IEnumerable list) return list.Cast<object?>().Select(ProtocolValue).ToArray();
        var fields = type.GetFields(BindingFlags.Instance | BindingFlags.Public)
            .ToDictionary(f => f.Name, f => ProtocolValue(f.GetValue(value)));
        fields["_type"] = type.Name;
        if (value is ChallengeInformation challenge)
        {
            var record = ChallengeRecord.GetChallenge(challenge.challengeId);
            fields["name"] = record?.Name ?? $"Challenge {challenge.challengeId}";
            fields["description"] = record?.Description ?? "";
        }
        return fields;
    }

    /// <summary>Modern-only synthetic event (sequence children). It never exists
    /// on the legacy wire: the JSON projection is sent directly, so legacy
    /// clients are unaffected. Same envelope as message projections.</summary>
    public static string BuildSyntheticJson(WorldClient client, string name, object? data, long revision)
    {
        var fight = client.Character?.Fighter?.Fight;
        return JsonSerializer.Serialize(new
        {
            schemaVersion = 1,
            metaVersion = MetaVersion,
            revision,
            characterId = client.Character?.Id.ToString(),
            fightKey = fight == null ? null : ModernFightSnapshot.Key(fight),
            messageId = (ushort?)null,
            name,
            data = data ?? new { },
            snapshot = (object?)null,
        });
    }

    public static string BuildJson(WorldClient client, NetworkMessage message, long revision)
    {
        var fight = client.Character?.Fighter?.Fight;
        bool checkpoint = message is GameFightJoinMessage or GameFightSynchronizeMessage
            or GameFightTurnReadyRequestMessage or SequenceEndMessage or GameEntitiesDispositionMessage
            or GameFightHumanReadyStateMessage or GameFightTurnStartMessage or GameFightEndMessage
            or GameFightPlacementPossiblePositionsMessage or ChallengeAddMessage or ChallengeProposalMessage;
        var projected = ProtocolValue(message);
        if (message is GameActionFightPointsVariationMessage variation &&
            projected is Dictionary<string, object?> fields)
        {
            Meta.TryGetValue(message, out var meta);
            var metaResource = meta != null && meta.TryGetValue("resource", out var resource) ? resource as string : null;
            var resolved = ResolveResource(variation.actionId, metaResource);
            if (resolved != null)
            {
                fields["resource"] = resolved;
                fields["reason"] = meta != null && meta.TryGetValue("reason", out var reason) && reason is string text
                    ? text
                    : (variation.delta < 0 ? "withdraw" : "gain");
                fields["metaVersion"] = MetaVersion;
            }
        }
        return JsonSerializer.Serialize(new
        {
            schemaVersion = 1,
            metaVersion = MetaVersion,
            revision,
            characterId = client.Character?.Id.ToString(),
            fightKey = fight == null ? null : ModernFightSnapshot.Key(fight),
            messageId = message.MessageId,
            name = message.GetType().Name,
            data = projected,
            snapshot = checkpoint && fight != null ? ModernFightSnapshot.Build(fight, client.Character!.Fighter) : null,
        });
    }
}
