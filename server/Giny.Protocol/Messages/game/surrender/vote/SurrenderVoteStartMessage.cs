using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class SurrenderVoteStartMessage : NetworkMessage
    {
        public const ushort Id = 6177;
        public override ushort MessageId => Id;

        public bool alreadyCastedVote;
        public int numberOfParticipants;
        public int castedVoteNumber;
        public int voteDuration;

        public SurrenderVoteStartMessage()
        {
        }
        public SurrenderVoteStartMessage(bool alreadyCastedVote, int numberOfParticipants, int castedVoteNumber, int voteDuration)
        {
            this.alreadyCastedVote = alreadyCastedVote;
            this.numberOfParticipants = numberOfParticipants;
            this.castedVoteNumber = castedVoteNumber;
            this.voteDuration = voteDuration;
        }
        public override void Serialize(IDataWriter writer)
        {
            writer.WriteBoolean((bool)alreadyCastedVote);
            writer.WriteInt((int)numberOfParticipants);
            writer.WriteInt((int)castedVoteNumber);
            writer.WriteInt((int)voteDuration);
        }
        public override void Deserialize(IDataReader reader)
        {
            alreadyCastedVote = (bool)reader.ReadBoolean();
            numberOfParticipants = (int)reader.ReadInt();
            castedVoteNumber = (int)reader.ReadInt();
            voteDuration = (int)reader.ReadInt();
        }

    }
}


