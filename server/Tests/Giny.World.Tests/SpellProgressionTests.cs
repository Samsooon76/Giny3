using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Runtime.Serialization;
using Giny.Core.Network.Messages;
using Giny.Protocol.Messages;
using Giny.World.Managers.Entities.Characters;
using Giny.World.Managers.Fights.Fighters;
using Giny.World.Managers.Shortcuts;
using Giny.World.Managers.Spells;
using Giny.World.Network;
using Giny.World.Records.Characters;
using Giny.World.Records.Spells;
using Xunit;

namespace Giny.World.Tests;

public class SpellProgressionTests
{
    sealed class RecordingClient : WorldClient
    {
        public List<NetworkMessage> Messages { get; } = new();
        public override void Send(NetworkMessage message) => Messages.Add(message);
    }

    static void Set(object target, string property, object value) =>
        target.GetType().GetProperty(property)!.SetValue(target, value);
    static void SetLevel(Character character, short level) =>
        typeof(Character).GetField("m_level", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(character, level);

    static SpellRecord Record(short id, params int[] thresholds) => new()
    {
        Id = id,
        Levels = thresholds.Select((minimum, i) => new SpellLevelRecord
        {
            Id = id * 10 + i, Grade = (byte)(i + 1), MinPlayerLevel = minimum,
        }).ToList(),
    };

    static (Character character, RecordingClient client, CharacterSpell spell) Fixture(short level, SpellRecord record)
    {
        // Isolate spell progression from database, map and inventory startup.
        var character = (Character)FormatterServices.GetUninitializedObject(typeof(Character));
        var client = new RecordingClient();
        var spell = new CharacterSpell(record.Id);
        typeof(CharacterSpell).GetField("m_record", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(spell, record);
        Set(character, "Record", new CharacterRecord { Spells = new List<CharacterSpell> { spell }, Shortcuts = new List<CharacterShortcut>() });
        Set(character, "Client", client);
        SetLevel(character, level);
        Set(character, "SpellShortcutBar", new SpellShortcutBar(character));
        Set(character, "GeneralShortcutBar", new GeneralShortcutBar(character));
        return (character, client, spell);
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(65, 1)]
    [InlineData(66, 2)]
    [InlineData(131, 2)]
    [InlineData(132, 3)]
    [InlineData(200, 3)]
    [InlineData(1000, 3)]
    public void RankFollowsObtentionThresholds(short level, byte expected)
    {
        var (character, _, spell) = Fixture(level, Record(100, 1, 66, 132));
        Assert.Equal(expected, spell.GetGrade(character));
        Assert.Equal(expected, spell.GetSpellItem(character).spellLevel);
    }

    [Fact]
    public void LevelJumpUnlocksShortcutAndSendsUpdatedRankWithoutDuplicates()
    {
        var (character, client, _) = Fixture(132, Record(100, 6, 66, 132));
        character.UpdateSpells(1, 132);
        Assert.Equal((short)100, Assert.Single(character.Record.Shortcuts.OfType<CharacterSpellShortcut>()).SpellId);
        var list = Assert.Single(client.Messages.OfType<SpellListMessage>());
        Assert.Equal(3, Assert.Single(list.spells).spellLevel);
        character.UpdateSpells(1, 132);
        Assert.Single(character.Record.Shortcuts);
    }

    [Fact]
    public void ActiveVariantUsesItsOwnUnlockLevelAndShortcutId()
    {
        var record = Record(100, 1, 66, 132);
        record.VariantRecord = Record(101, 100, 160);
        var (character, _, spell) = Fixture(99, record);
        spell.Variant = true;
        Assert.False(spell.Learned(character));
        // Login teaches breed spells again: selecting a variant must not add a duplicate base spell.
        Assert.False(character.LearnSpell(record.Id, false));
        Assert.Single(character.Record.Spells);
        SetLevel(character, 160);
        character.UpdateSpells(99, 160);
        Assert.True(spell.Learned(character));
        Assert.Equal(2, spell.GetGrade(character));
        Assert.Equal((short)101, Assert.Single(character.Record.Shortcuts.OfType<CharacterSpellShortcut>()).SpellId);
    }

    [Fact]
    public void CombatRejectsLockedSpellsAndUsesNewRankAtThreshold()
    {
        var (character, _, _) = Fixture(5, Record(100, 6, 66, 132));
        var fighter = (CharacterFighter)FormatterServices.GetUninitializedObject(typeof(CharacterFighter));
        Set(fighter, "Character", character);
        Assert.Empty(fighter.GetSpells());
        Assert.Null(fighter.GetSpell(100));
        SetLevel(character, 6);
        Assert.Single(fighter.GetSpells());
        Assert.Equal(1, fighter.GetSpell(100).Level.Grade);
        SetLevel(character, 132);
        Assert.Equal(3, fighter.GetSpell(100).Level.Grade);
    }
}
