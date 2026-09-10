using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class AchievementsPioneerRanksMessage : NetworkMessage
    {
        public const ushort Id = 3443;
        public override ushort MessageId => Id;

        public AchievementPioneerRank[] achievementsPioneerRanks;

        public AchievementsPioneerRanksMessage()
        {
        }
        public AchievementsPioneerRanksMessage(AchievementPioneerRank[] achievementsPioneerRanks)
        {
            this.achievementsPioneerRanks = achievementsPioneerRanks;
        }
        public override void Serialize(IDataWriter writer)
        {
            writer.WriteShort((short)achievementsPioneerRanks.Length);
            for (uint _i1 = 0; _i1 < achievementsPioneerRanks.Length; _i1++)
            {
                (achievementsPioneerRanks[_i1] as AchievementPioneerRank).Serialize(writer);
            }

        }
        public override void Deserialize(IDataReader reader)
        {
            AchievementPioneerRank _item1 = null;
            uint _achievementsPioneerRanksLen = (uint)(reader.ReadUShort());
            achievementsPioneerRanks = new AchievementPioneerRank[_achievementsPioneerRanksLen];
            for (uint _i1 = 0; _i1 < _achievementsPioneerRanksLen; _i1++)
            {
                _item1 = new AchievementPioneerRank();
                _item1.Deserialize(reader);
                achievementsPioneerRanks[_i1] = _item1;
            }

        }

    }
}


