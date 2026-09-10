using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class SurrenderVoteCastMessage : NetworkMessage
    {
        public const ushort Id = 4209;
        public override ushort MessageId => Id;

        public bool vote;

        public SurrenderVoteCastMessage()
        {
        }
        public SurrenderVoteCastMessage(bool vote)
        {
            this.vote = vote;
        }
        public override void Serialize(IDataWriter writer)
        {
            writer.WriteBoolean((bool)vote);
        }
        public override void Deserialize(IDataReader reader)
        {
            vote = (bool)reader.ReadBoolean();
        }

    }
}


