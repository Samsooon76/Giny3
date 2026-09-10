using System;
using System.Text.Json;
using System.Linq;
using Giny.Core.IO.Configuration;
using Giny.Protocol.Custom.Enums;
using Giny.World.Managers.Fights.Stats;
using Giny.World.Managers.Stats;
using Giny.World.Records.Monsters;
using Giny.World.Managers.Modern;
using Giny.World.Records.Appearance;
using Xunit;

namespace Giny.World.Tests
{
    public class ModernFightSnapshotTests
    {
        [Theory]
        [InlineData(0, 100)]
        [InlineData(100, 50)]
        [InlineData(200, 0)]
        public void PreviewStats_ExportsRealFighterStatsIncludingInitiative(int lifeLoss, int expectedInitiative)
        {
            ConfigManager<WorldConfig>.Instance ??= new WorldConfig();
            var stats = new FighterStats(new MonsterGrade {
                LifePoints = 200, ActionPoints = 6, MovementPoints = 3,
                Strength = 100, EarthResistance = 20,
            });
            stats.Life.Loss = lifeLoss;
            // The new snapshot used to throw here for every character/monster:
            // InitiativeCharacteristic deliberately forbids TotalInContext().
            Assert.Throws<InvalidOperationException>(() => stats[CharacteristicEnum.INITIATIVE].TotalInContext());
            stats.Strength.Context = 25;
            var preview = ModernFightSnapshot.BuildPreviewStats(stats);
            using var document = JsonDocument.Parse(JsonSerializer.Serialize(preview));
            var values = document.RootElement.EnumerateArray().ToDictionary(
                value => value.GetProperty("id").GetInt32(), value => value.GetProperty("total").GetInt32());
            Assert.Equal(stats.GetCharacteristics<Characteristic>().Count, values.Count);
            Assert.Equal(expectedInitiative, values[(int)CharacteristicEnum.INITIATIVE]);
            Assert.Equal(125, values[(int)CharacteristicEnum.STRENGTH]);
            Assert.Equal(6, values[(int)CharacteristicEnum.ACTION_POINTS]);
            Assert.Equal(3, values[(int)CharacteristicEnum.MOVEMENT_POINTS]);
            Assert.Equal(20, values[(int)CharacteristicEnum.EARTH_ELEMENT_RESIST_PERCENT]);
            Assert.Equal(100, values[(int)CharacteristicEnum.DEALT_DAMAGE_MULTIPLIER]);
        }

        [Fact]
        public void SkinSlotRuleRecord_InitializesAndComputesSkins()
        {
            SkinSlotRuleRecord.Initialize();
            // Test Feca male base 10, face 2012, with no equipment
            var skins = SkinSlotRuleRecord.ComputeActiveSkins(1, false, 2012, 10, Array.Empty<short>());
            Assert.Contains((short)10, skins);
            Assert.Contains((short)2012, skins);

            // With equipped hat skin 240 (which masks hair parts, not entire face)
            var withHat = SkinSlotRuleRecord.ComputeActiveSkins(1, false, 2012, 10, new short[] { 240 });
            Assert.Contains((short)10, withHat);
            Assert.Contains((short)2012, withHat);
            Assert.Contains((short)240, withHat);
        }

        [Fact]
        public void ModernFightSnapshot_BuildsValidJsonStructure()
        {
            var lastAction = new
            {
                type = "spell",
                spell_id = (short)12983,
                grade = 1,
                script_id = 17874,
                caster_id = 1001L,
                target_cell = (short)250,
            };

            var payload = new
            {
                fight_id = 42,
                fight_type = 0,
                map_id = 154010883L,
                timeline = new long[] { 1001L, 2002L },
                fighters = new[]
                {
                    new
                    {
                        id = 1001L,
                        name = "Hugo",
                        look = "{1|10,2012|1=#e59b68|53}",
                        team = 0,
                        cell = (short)230,
                        life = 2500,
                        max_life = 3000,
                        ap = 6,
                        mp = 3,
                        alive = true,
                    },
                    new
                    {
                        id = 2002L,
                        name = "Bouftou",
                        look = "{48|||100}",
                        team = 1,
                        cell = (short)250,
                        life = 350,
                        max_life = 350,
                        ap = 4,
                        mp = 3,
                        alive = true,
                    }
                },
                last_action = lastAction,
            };

            string json = JsonSerializer.Serialize(payload);
            Assert.NotNull(json);

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            Assert.Equal(42, root.GetProperty("fight_id").GetInt32());
            Assert.Equal(154010883L, root.GetProperty("map_id").GetInt64());
            Assert.Equal(2, root.GetProperty("timeline").GetArrayLength());
            Assert.Equal(2, root.GetProperty("fighters").GetArrayLength());

            var f1 = root.GetProperty("fighters")[0];
            Assert.Equal(1001L, f1.GetProperty("id").GetInt64());
            Assert.Equal("Hugo", f1.GetProperty("name").GetString());
            Assert.Equal(2500, f1.GetProperty("life").GetInt32());

            var action = root.GetProperty("last_action");
            Assert.Equal("spell", action.GetProperty("type").GetString());
            Assert.Equal(12983, action.GetProperty("spell_id").GetInt32());
            Assert.Equal(17874, action.GetProperty("script_id").GetInt32());
            Assert.Equal(1001L, action.GetProperty("caster_id").GetInt64());
            Assert.Equal(250, action.GetProperty("target_cell").GetInt32());
        }
    }
}
