using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class AllianceListMessage : NetworkMessage
    {
        public const ushort Id = 9553;
        public override ushort MessageId => Id;

        public AllianceFactSheetInformation[] alliances;

        public AllianceListMessage()
        {
        }
        public AllianceListMessage(AllianceFactSheetInformation[] alliances)
        {
            this.alliances = alliances;
        }
        public override void Serialize(IDataWriter writer)
        {
            writer.WriteShort((short)alliances.Length);
            for (uint _i1 = 0; _i1 < alliances.Length; _i1++)
            {
                (alliances[_i1] as AllianceFactSheetInformation).Serialize(writer);
            }

        }
        public override void Deserialize(IDataReader reader)
        {
            AllianceFactSheetInformation _item1 = null;
            uint _alliancesLen = (uint)(reader.ReadUShort());
            alliances = new AllianceFactSheetInformation[_alliancesLen];
            for (uint _i1 = 0; _i1 < _alliancesLen; _i1++)
            {
                _item1 = new AllianceFactSheetInformation();
                _item1.Deserialize(reader);
                alliances[_i1] = _item1;
            }

        }

    }
}


