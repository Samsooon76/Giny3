using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class SurrenderInfoResponseMessage : NetworkMessage
    {
        public const ushort Id = 99;
        public override ushort MessageId => Id;

        public bool hasSanction;
        public SurrenderResponse surrenderResponse;
        public SurrenderVoteResponse surrenderVoteResponse;

        public SurrenderInfoResponseMessage()
        {
        }
        public SurrenderInfoResponseMessage(bool hasSanction, SurrenderResponse surrenderResponse, SurrenderVoteResponse surrenderVoteResponse)
        {
            this.hasSanction = hasSanction;
            this.surrenderResponse = surrenderResponse;
            this.surrenderVoteResponse = surrenderVoteResponse;
        }
        public override void Serialize(IDataWriter writer)
        {
            writer.WriteBoolean((bool)hasSanction);
            writer.WriteShort((short)surrenderResponse.TypeId);
            surrenderResponse.Serialize(writer);
            writer.WriteShort((short)surrenderVoteResponse.TypeId);
            surrenderVoteResponse.Serialize(writer);
        }
        public override void Deserialize(IDataReader reader)
        {
            hasSanction = (bool)reader.ReadBoolean();
            uint _id2 = (uint)(reader.ReadUShort());
            surrenderResponse = ProtocolTypeManager.GetInstance<SurrenderResponse>((short)_id2);
            surrenderResponse.Deserialize(reader);
            uint _id3 = (uint)(reader.ReadUShort());
            surrenderVoteResponse = ProtocolTypeManager.GetInstance<SurrenderVoteResponse>((short)_id3);
            surrenderVoteResponse.Deserialize(reader);
        }

    }
}


