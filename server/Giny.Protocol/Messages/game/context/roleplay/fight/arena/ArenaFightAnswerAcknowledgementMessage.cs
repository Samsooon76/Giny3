using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class ArenaFightAnswerAcknowledgementMessage : NetworkMessage
    {
        public const ushort Id = 2033;
        public override ushort MessageId => Id;

        public bool acknowledged;

        public ArenaFightAnswerAcknowledgementMessage()
        {
        }
        public ArenaFightAnswerAcknowledgementMessage(bool acknowledged)
        {
            this.acknowledged = acknowledged;
        }
        public override void Serialize(IDataWriter writer)
        {
            writer.WriteBoolean((bool)acknowledged);
        }
        public override void Deserialize(IDataReader reader)
        {
            acknowledged = (bool)reader.ReadBoolean();
        }

    }
}


