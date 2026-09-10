using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class ExchangeObjectRemovedMessage : ExchangeObjectMessage
    {
        public new const ushort Id = 8090;
        public override ushort MessageId => Id;

        public int objectUID;

        public ExchangeObjectRemovedMessage()
        {
        }
        public ExchangeObjectRemovedMessage(int objectUID, bool remote)
        {
            this.objectUID = objectUID;
            this.remote = remote;
        }
        public override void Serialize(IDataWriter writer)
        {
            base.Serialize(writer);
            if (objectUID < 0)
            {
                throw new System.Exception("Forbidden value (" + objectUID + ") on element objectUID.");
            }

            writer.WriteVarInt((int)objectUID);
        }
        public override void Deserialize(IDataReader reader)
        {
            base.Deserialize(reader);
            objectUID = (int)reader.ReadVarUhInt();
            if (objectUID < 0)
            {
                throw new System.Exception("Forbidden value (" + objectUID + ") on element of ExchangeObjectRemovedMessage.objectUID.");
            }

        }

    }
}


