using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class AccessoryPreviewMessage : NetworkMessage
    {
        public const ushort Id = 1503;
        public override ushort MessageId => Id;

        public EntityLook look;

        public AccessoryPreviewMessage()
        {
        }
        public AccessoryPreviewMessage(EntityLook look)
        {
            this.look = look;
        }
        public override void Serialize(IDataWriter writer)
        {
            look.Serialize(writer);
        }
        public override void Deserialize(IDataReader reader)
        {
            look = new EntityLook();
            look.Deserialize(reader);
        }

    }
}


