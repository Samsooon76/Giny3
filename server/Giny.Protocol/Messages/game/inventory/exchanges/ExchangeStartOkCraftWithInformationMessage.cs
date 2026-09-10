using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class ExchangeStartOkCraftWithInformationMessage : ExchangeStartOkCraftMessage
    {
        public new const ushort Id = 4096;
        public override ushort MessageId => Id;

        public int skillId;

        public ExchangeStartOkCraftWithInformationMessage()
        {
        }
        public ExchangeStartOkCraftWithInformationMessage(int skillId)
        {
            this.skillId = skillId;
        }
        public override void Serialize(IDataWriter writer)
        {
            base.Serialize(writer);
            if (skillId < 0)
            {
                throw new System.Exception("Forbidden value (" + skillId + ") on element skillId.");
            }

            writer.WriteVarInt((int)skillId);
        }
        public override void Deserialize(IDataReader reader)
        {
            base.Deserialize(reader);
            skillId = (int)reader.ReadVarUhInt();
            if (skillId < 0)
            {
                throw new System.Exception("Forbidden value (" + skillId + ") on element of ExchangeStartOkCraftWithInformationMessage.skillId.");
            }

        }

    }
}


