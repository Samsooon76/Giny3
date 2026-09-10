using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class TaxCollectorDialogQuestionBasicMessage : NetworkMessage
    {
        public const ushort Id = 3500;
        public override ushort MessageId => Id;

        public BasicAllianceInformations allianceInfo;

        public TaxCollectorDialogQuestionBasicMessage()
        {
        }
        public TaxCollectorDialogQuestionBasicMessage(BasicAllianceInformations allianceInfo)
        {
            this.allianceInfo = allianceInfo;
        }
        public override void Serialize(IDataWriter writer)
        {
            allianceInfo.Serialize(writer);
        }
        public override void Deserialize(IDataReader reader)
        {
            allianceInfo = new BasicAllianceInformations();
            allianceInfo.Deserialize(reader);
        }

    }
}


