using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class BreachRewardBuyMessage : NetworkMessage
    {
        public const ushort Id = 3872;
        public override ushort MessageId => Id;

        public int id;

        public BreachRewardBuyMessage()
        {
        }
        public BreachRewardBuyMessage(int id)
        {
            this.id = id;
        }
        public override void Serialize(IDataWriter writer)
        {
            if (id < 0)
            {
                throw new System.Exception("Forbidden value (" + id + ") on element id.");
            }

            writer.WriteVarInt((int)id);
        }
        public override void Deserialize(IDataReader reader)
        {
            id = (int)reader.ReadVarUhInt();
            if (id < 0)
            {
                throw new System.Exception("Forbidden value (" + id + ") on element of BreachRewardBuyMessage.id.");
            }

        }

    }
}


