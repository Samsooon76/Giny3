using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class AllianceModificationEmblemValidMessage : NetworkMessage
    {
        public const ushort Id = 5179;
        public override ushort MessageId => Id;

        public SocialEmblem allianceEmblem;

        public AllianceModificationEmblemValidMessage()
        {
        }
        public AllianceModificationEmblemValidMessage(SocialEmblem allianceEmblem)
        {
            this.allianceEmblem = allianceEmblem;
        }
        public override void Serialize(IDataWriter writer)
        {
            allianceEmblem.Serialize(writer);
        }
        public override void Deserialize(IDataReader reader)
        {
            allianceEmblem = new SocialEmblem();
            allianceEmblem.Deserialize(reader);
        }

    }
}


