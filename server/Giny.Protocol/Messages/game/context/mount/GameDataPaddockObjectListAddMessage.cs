using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class GameDataPaddockObjectListAddMessage : NetworkMessage
    {
        public const ushort Id = 9121;
        public override ushort MessageId => Id;

        public PaddockItem[] paddockItemDescription;

        public GameDataPaddockObjectListAddMessage()
        {
        }
        public GameDataPaddockObjectListAddMessage(PaddockItem[] paddockItemDescription)
        {
            this.paddockItemDescription = paddockItemDescription;
        }
        public override void Serialize(IDataWriter writer)
        {
            writer.WriteShort((short)paddockItemDescription.Length);
            for (uint _i1 = 0; _i1 < paddockItemDescription.Length; _i1++)
            {
                (paddockItemDescription[_i1] as PaddockItem).Serialize(writer);
            }

        }
        public override void Deserialize(IDataReader reader)
        {
            PaddockItem _item1 = null;
            uint _paddockItemDescriptionLen = (uint)(reader.ReadUShort());
            paddockItemDescription = new PaddockItem[_paddockItemDescriptionLen];
            for (uint _i1 = 0; _i1 < _paddockItemDescriptionLen; _i1++)
            {
                _item1 = new PaddockItem();
                _item1.Deserialize(reader);
                paddockItemDescription[_i1] = _item1;
            }

        }

    }
}


