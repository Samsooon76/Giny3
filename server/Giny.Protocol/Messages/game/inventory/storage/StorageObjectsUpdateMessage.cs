using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class StorageObjectsUpdateMessage : NetworkMessage
    {
        public const ushort Id = 5323;
        public override ushort MessageId => Id;

        public ObjectItem[] objectList;

        public StorageObjectsUpdateMessage()
        {
        }
        public StorageObjectsUpdateMessage(ObjectItem[] objectList)
        {
            this.objectList = objectList;
        }
        public override void Serialize(IDataWriter writer)
        {
            writer.WriteShort((short)objectList.Length);
            for (uint _i1 = 0; _i1 < objectList.Length; _i1++)
            {
                (objectList[_i1] as ObjectItem).Serialize(writer);
            }

        }
        public override void Deserialize(IDataReader reader)
        {
            ObjectItem _item1 = null;
            uint _objectListLen = (uint)(reader.ReadUShort());
            objectList = new ObjectItem[_objectListLen];
            for (uint _i1 = 0; _i1 < _objectListLen; _i1++)
            {
                _item1 = new ObjectItem();
                _item1.Deserialize(reader);
                objectList[_i1] = _item1;
            }

        }

    }
}


