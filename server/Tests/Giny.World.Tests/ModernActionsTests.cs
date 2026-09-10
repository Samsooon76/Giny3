using System;
using Giny.Protocol.Custom.Enums;
using Giny.Protocol.Messages;
using Giny.World.Managers.Items;
using Giny.World.Managers.Modern;
using Xunit;

namespace Giny.World.Tests
{
    public class ModernActionsTests
    {
        [Theory]
        [InlineData("null")]
        [InlineData("\"12\"")]
        [InlineData("-1")]
        [InlineData("2147483648")]
        [InlineData("1.5")]
        public void RejectsInvalidCommandIntegers(string value)
        {
            var request = ModernActionRequest.Parse("{\"schemaVersion\":1,\"requestId\":\"" + Guid.NewGuid() + "\",\"characterId\":\"42\",\"action\":\"item.use\",\"args\":{\"uid\":" + value + "}}");
            Assert.Throws<ArgumentException>(() => request.Int("uid", 1, int.MaxValue));
        }

        [Fact]
        public void ParsesStableCharacterIdAndClonesArguments()
        {
            var request = ModernActionRequest.Parse("{\"schemaVersion\":1,\"requestId\":\"" + Guid.NewGuid() + "\",\"characterId\":\"9007199254740993\",\"action\":\"item.use\",\"args\":{\"uid\":123}}");
            Assert.Equal(9007199254740993L, request.CharacterId);
            Assert.Equal(123, request.Int("uid", 1, int.MaxValue));
        }

        [Fact]
        public void SlotRulesRejectWeaponsInArmourSlots()
        {
            Assert.Equal(new[] { 2, 4 }, ModernEquipmentRules.Positions(ItemTypeEnum.RING, false, false));
            Assert.Equal(new[] { 1 }, ModernEquipmentRules.Positions((ItemTypeEnum)(-1), false, true));
            Assert.Empty(ModernEquipmentRules.Positions((ItemTypeEnum)(-1), false, false));
        }

        [Fact]
        public void CustomMessageIdsFitFourteenBitsAndAreDistinct()
        {
            int[] ids = { ModernActionRequestMessage.Id, ModernActionResultMessage.Id, ModernCharacterSnapshotMessage.Id,
                ModernCharacterSnapshotRequestMessage.Id, ModernMapSnapshotMessage.Id, ModernMapSnapshotRequestMessage.Id, ModernFightSnapshotMessage.Id, ModernModuleStateMessage.Id };
            var unique = new System.Collections.Generic.HashSet<int>();
            foreach (var id in ids) { Assert.InRange(id, 0, 16383); Assert.True(unique.Add(id)); }
        }
    }
}
