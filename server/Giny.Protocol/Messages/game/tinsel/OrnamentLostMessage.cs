using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class OrnamentLostMessage : NetworkMessage
    {
        public const ushort Id = 2799;
        public override ushort MessageId => Id;

        public short ornamentId;

        public OrnamentLostMessage()
        {
        }
        public OrnamentLostMessage(short ornamentId)
        {
            this.ornamentId = ornamentId;
        }
        public override void Serialize(IDataWriter writer)
        {
            if (ornamentId < 0)
            {
                throw new System.Exception("Forbidden value (" + ornamentId + ") on element ornamentId.");
            }

            writer.WriteShort((short)ornamentId);
        }
        public override void Deserialize(IDataReader reader)
        {
            ornamentId = (short)reader.ReadShort();
            if (ornamentId < 0)
            {
                throw new System.Exception("Forbidden value (" + ornamentId + ") on element of OrnamentLostMessage.ornamentId.");
            }

        }

    }
}


