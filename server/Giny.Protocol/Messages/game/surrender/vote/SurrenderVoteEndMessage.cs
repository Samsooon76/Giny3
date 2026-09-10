using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class SurrenderVoteEndMessage : NetworkMessage
    {
        public const ushort Id = 6083;
        public override ushort MessageId => Id;

        public bool voteResult;

        public SurrenderVoteEndMessage()
        {
        }
        public SurrenderVoteEndMessage(bool voteResult)
        {
            this.voteResult = voteResult;
        }
        public override void Serialize(IDataWriter writer)
        {
            writer.WriteBoolean((bool)voteResult);
        }
        public override void Deserialize(IDataReader reader)
        {
            voteResult = (bool)reader.ReadBoolean();
        }

    }
}


