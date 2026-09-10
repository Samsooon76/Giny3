using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class ReportResponseMessage : NetworkMessage
    {
        public const ushort Id = 8138;
        public override ushort MessageId => Id;

        public bool success;

        public ReportResponseMessage()
        {
        }
        public ReportResponseMessage(bool success)
        {
            this.success = success;
        }
        public override void Serialize(IDataWriter writer)
        {
            writer.WriteBoolean((bool)success);
        }
        public override void Deserialize(IDataReader reader)
        {
            success = (bool)reader.ReadBoolean();
        }

    }
}


