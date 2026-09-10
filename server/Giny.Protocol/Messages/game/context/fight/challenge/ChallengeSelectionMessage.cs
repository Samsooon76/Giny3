using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class ChallengeSelectionMessage : NetworkMessage
    {
        public const ushort Id = 5920;
        public override ushort MessageId => Id;

        public int challengeId;

        public ChallengeSelectionMessage()
        {
        }
        public ChallengeSelectionMessage(int challengeId)
        {
            this.challengeId = challengeId;
        }
        public override void Serialize(IDataWriter writer)
        {
            if (challengeId < 0)
            {
                throw new System.Exception("Forbidden value (" + challengeId + ") on element challengeId.");
            }

            writer.WriteVarInt((int)challengeId);
        }
        public override void Deserialize(IDataReader reader)
        {
            challengeId = (int)reader.ReadVarUhInt();
            if (challengeId < 0)
            {
                throw new System.Exception("Forbidden value (" + challengeId + ") on element of ChallengeSelectionMessage.challengeId.");
            }

        }

    }
}


