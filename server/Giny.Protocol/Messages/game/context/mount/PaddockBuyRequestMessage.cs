using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class PaddockBuyRequestMessage : NetworkMessage
    {
        public const ushort Id = 1669;
        public override ushort MessageId => Id;

        public long proposedPrice;

        public PaddockBuyRequestMessage()
        {
        }
        public PaddockBuyRequestMessage(long proposedPrice)
        {
            this.proposedPrice = proposedPrice;
        }
        public override void Serialize(IDataWriter writer)
        {
            if (proposedPrice < 0 || proposedPrice > 9007199254740992)
            {
                throw new System.Exception("Forbidden value (" + proposedPrice + ") on element proposedPrice.");
            }

            writer.WriteVarLong((long)proposedPrice);
        }
        public override void Deserialize(IDataReader reader)
        {
            proposedPrice = (long)reader.ReadVarUhLong();
            if (proposedPrice < 0 || proposedPrice > 9007199254740992)
            {
                throw new System.Exception("Forbidden value (" + proposedPrice + ") on element of PaddockBuyRequestMessage.proposedPrice.");
            }

        }

    }
}


