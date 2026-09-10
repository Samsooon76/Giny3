using System.Text.Json;
using Giny.Protocol.Messages;
using Giny.Protocol.Types;
using Giny.World.Managers.Fights.Fighters;
using Giny.World.Managers.Fights.Results;
using Giny.World.Managers.Modern;
using Giny.World.Network;
using Xunit;

namespace Giny.World.Tests;
public class ModernCombatTests
{
    [Fact]
    public void LootAggregatesAllQuantitiesAcrossBothOverloads()
    {
        var loot = new Loot();
        loot.AddItem(385, 3); loot.AddItem(385, 4); loot.AddItem(new DroppedItem(385, 6));
        Assert.Equal(13, loot.Items[385].Amount);
        Assert.Equal(13, loot.GetFightLoot().objects[0].quantity);
    }
    [Fact]
    public void ProjectionPreservesDerivedResultsAndExactExperience()
    {
        var message = new GameFightEndMessage(61000, 0, 0, new FightResultListEntry[] {
            new FightResultPlayerListEntry { id = 101, outcome = 2, level = 42, alive = true,
                rewards = new FightLoot(new[] { new FightLootObject(385, 13, 0) }, 123),
                additional = new FightResultAdditionalData[] { new FightResultExperienceData { experienceFightDelta = 9007199254740993 } } }
        }, System.Array.Empty<NamedPartyTeamWithOutcome>());
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(ModernCombatEvents.ProtocolValue(message)));
        var result = doc.RootElement.GetProperty("results")[0];
        Assert.Equal("FightResultPlayerListEntry", result.GetProperty("_type").GetString());
        Assert.Equal(42, result.GetProperty("level").GetInt32());
        Assert.Equal("9007199254740993", result.GetProperty("additional")[0].GetProperty("experienceFightDelta").GetString());
        Assert.Equal(13, result.GetProperty("rewards").GetProperty("objects")[0].GetProperty("quantity").GetInt32());
    }
    [Fact]
    public void SpellProjectionIncludesInheritedSourceAndTargetFields()
    {
        var cast = new GameActionFightSpellCastMessage { spellId = 12983, sourceId = 101, targetId = -3, destinationCellId = 250, portalsIds = System.Array.Empty<short>() };
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(ModernCombatEvents.ProtocolValue(cast)));
        Assert.Equal(101, doc.RootElement.GetProperty("sourceId").GetDouble());
        Assert.Equal(-3, doc.RootElement.GetProperty("targetId").GetDouble());
        Assert.Equal(250, doc.RootElement.GetProperty("destinationCellId").GetInt32());
    }
    private static string? ProjectedResource(GameActionFightPointsVariationMessage message, long revision = 1)
    {
        using var doc = JsonDocument.Parse(ModernCombatEvents.BuildJson(new WorldClient(), message, revision));
        var data = doc.RootElement.GetProperty("data");
        return data.TryGetProperty("resource", out var resource) ? resource.GetString() : null;
    }
    private static string? ProjectedReason(GameActionFightPointsVariationMessage message)
    {
        using var doc = JsonDocument.Parse(ModernCombatEvents.BuildJson(new WorldClient(), message, 1));
        var data = doc.RootElement.GetProperty("data");
        return data.TryGetProperty("reason", out var reason) ? reason.GetString() : null;
    }
    [Fact]
    public void OrdinaryCostsKeepWireZeroButProjectEmissionResource()
    {
        // Spell/movement costs keep actionId 0 on the legacy wire; the modern
        // projection carries the resource known at the emission point.
        var spellCost = new GameActionFightPointsVariationMessage { actionId = 0, delta = -4, sourceId = 101, targetId = 101 };
        ModernCombatEvents.TagPointsVariation(spellCost, "ap", "spell_cost");
        Assert.Equal("ap", ProjectedResource(spellCost));
        Assert.Equal("spell_cost", ProjectedReason(spellCost));

        var walkCost = new GameActionFightPointsVariationMessage { actionId = 0, delta = -3, sourceId = 101, targetId = 101 };
        ModernCombatEvents.TagPointsVariation(walkCost, "mp", "movement_cost");
        Assert.Equal("mp", ProjectedResource(walkCost));
        Assert.Equal("movement_cost", ProjectedReason(walkCost));

        var tackleLoss = new GameActionFightPointsVariationMessage { actionId = 127, delta = -2, sourceId = 101, targetId = 101 };
        ModernCombatEvents.TagPointsVariation(tackleLoss, "mp", "tackle");
        Assert.Equal("mp", ProjectedResource(tackleLoss));
        Assert.Equal("tackle", ProjectedReason(tackleLoss));
    }
    [Fact]
    public void KnownActionIdsResolveWithoutMetadataAndUnknownOnesStaySilent()
    {
        Assert.Equal("ap", ProjectedResource(new GameActionFightPointsVariationMessage { actionId = 101, delta = -2, sourceId = 1, targetId = 2 }));
        Assert.Equal("mp", ProjectedResource(new GameActionFightPointsVariationMessage { actionId = 127, delta = -2, sourceId = 1, targetId = 2 }));
        Assert.Equal("ap", ProjectedResource(new GameActionFightPointsVariationMessage { actionId = 120, delta = 2, sourceId = 1, targetId = 2 }));
        Assert.Equal("mp", ProjectedResource(new GameActionFightPointsVariationMessage { actionId = 78, delta = 2, sourceId = 1, targetId = 2 }));
        // A bare actionId 0 without emission metadata must not be guessed: the
        // client awaits the authoritative snapshot instead.
        Assert.Null(ProjectedResource(new GameActionFightPointsVariationMessage { actionId = 0, delta = -3, sourceId = 1, targetId = 2 }));
        using var doc = JsonDocument.Parse(ModernCombatEvents.BuildJson(new WorldClient(),
            new GameActionFightPointsVariationMessage { actionId = 101, delta = -1, sourceId = 1, targetId = 2 }, 7));
        Assert.Equal(1, doc.RootElement.GetProperty("metaVersion").GetInt32());
        Assert.Equal(1, doc.RootElement.GetProperty("schemaVersion").GetInt32());
    }
    [Fact]
    public void TackleLossClampNeverGoesNegative()
    {
        Assert.Equal(3, Fighter.ClampLoss(5, 3));
        Assert.Equal(3, Fighter.ClampLoss(3, 3));
        Assert.Equal(0, Fighter.ClampLoss(0, 3));
        Assert.Equal(0, Fighter.ClampLoss(-1, 3));
        Assert.Equal(0, Fighter.ClampLoss(2, 0));
        Assert.Equal(0, Fighter.ClampLoss(2, -4));
    }
    [Fact]
    public void SyntheticSequenceEventsShareTheProjectionEnvelope()
    {
        using var doc = JsonDocument.Parse(ModernCombatEvents.BuildSyntheticJson(new WorldClient(),
            "SequenceChildStartMessage", new { sequenceId = 7, parentId = 3, sequenceType = (byte)5, authorId = 101.0 }, 4));
        var root = doc.RootElement;
        Assert.Equal(1, root.GetProperty("schemaVersion").GetInt32());
        Assert.Equal(1, root.GetProperty("metaVersion").GetInt32());
        Assert.Equal(4, root.GetProperty("revision").GetInt32());
        Assert.Equal("SequenceChildStartMessage", root.GetProperty("name").GetString());
        Assert.Equal(7, root.GetProperty("data").GetProperty("sequenceId").GetInt32());
        Assert.Equal(3, root.GetProperty("data").GetProperty("parentId").GetInt32());
        Assert.Equal(JsonValueKind.Null, root.GetProperty("messageId").ValueKind);
        Assert.Equal(JsonValueKind.Null, root.GetProperty("snapshot").ValueKind);
    }
}
