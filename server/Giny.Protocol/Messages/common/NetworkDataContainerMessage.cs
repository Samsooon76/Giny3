using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class NetworkDataContainerMessage : NetworkMessage
    {
        public const ushort Id = 2;
        public override ushort MessageId => Id;

        private byte[] content;

        public NetworkDataContainerMessage()
        {
        }
        public override void Serialize(IDataWriter writer)
        {
            writer.WriteBytes((byte[])content);
            throw new System.Exception("Not implemented");
        }
        public override void Deserialize(IDataReader reader)
        {
            int _contentLen = reader.ReadVarInt();
            content = NetworkDataCompression.Decompress(reader.ReadBytes(_contentLen));
        }

    }
}


