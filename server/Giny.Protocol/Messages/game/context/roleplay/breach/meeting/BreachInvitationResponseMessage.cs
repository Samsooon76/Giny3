using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class BreachInvitationResponseMessage : NetworkMessage
    {
        public const ushort Id = 9260;
        public override ushort MessageId => Id;

        public CharacterMinimalInformations guest;
        public bool accept;

        public BreachInvitationResponseMessage()
        {
        }
        public BreachInvitationResponseMessage(CharacterMinimalInformations guest, bool accept)
        {
            this.guest = guest;
            this.accept = accept;
        }
        public override void Serialize(IDataWriter writer)
        {
            guest.Serialize(writer);
            writer.WriteBoolean((bool)accept);
        }
        public override void Deserialize(IDataReader reader)
        {
            guest = new CharacterMinimalInformations();
            guest.Deserialize(reader);
            accept = (bool)reader.ReadBoolean();
        }

    }
}


