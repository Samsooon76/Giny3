using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class StatedElementUpdatedMessage : NetworkMessage
    {
        public const ushort Id = 7859;
        public override ushort MessageId => Id;

        public StatedElement statedElement;

        public StatedElementUpdatedMessage()
        {
        }
        public StatedElementUpdatedMessage(StatedElement statedElement)
        {
            this.statedElement = statedElement;
        }
        public override void Serialize(IDataWriter writer)
        {
            statedElement.Serialize(writer);
        }
        public override void Deserialize(IDataReader reader)
        {
            statedElement = new StatedElement();
            statedElement.Deserialize(reader);
        }

    }
}


