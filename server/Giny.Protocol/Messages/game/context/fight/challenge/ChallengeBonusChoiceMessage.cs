using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class ChallengeBonusChoiceMessage : NetworkMessage
    {
        public const ushort Id = 2271;
        public override ushort MessageId => Id;

        public byte challengeBonus;

        public ChallengeBonusChoiceMessage()
        {
        }
        public ChallengeBonusChoiceMessage(byte challengeBonus)
        {
            this.challengeBonus = challengeBonus;
        }
        public override void Serialize(IDataWriter writer)
        {
            writer.WriteByte((byte)challengeBonus);
        }
        public override void Deserialize(IDataReader reader)
        {
            challengeBonus = (byte)reader.ReadByte();
            if (challengeBonus < 0)
            {
                throw new System.Exception("Forbidden value (" + challengeBonus + ") on element of ChallengeBonusChoiceMessage.challengeBonus.");
            }

        }

    }
}


