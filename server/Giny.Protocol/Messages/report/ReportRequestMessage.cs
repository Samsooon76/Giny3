using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class ReportRequestMessage : NetworkMessage
    {
        public const ushort Id = 8254;
        public override ushort MessageId => Id;

        public double targetId;
        public byte[] categories;
        public string description;

        public ReportRequestMessage()
        {
        }
        public ReportRequestMessage(double targetId, byte[] categories, string description)
        {
            this.targetId = targetId;
            this.categories = categories;
            this.description = description;
        }
        public override void Serialize(IDataWriter writer)
        {
            if (targetId < -9007199254740992 || targetId > 9007199254740992)
            {
                throw new System.Exception("Forbidden value (" + targetId + ") on element targetId.");
            }

            writer.WriteDouble((double)targetId);
            writer.WriteShort((short)categories.Length);
            for (uint _i2 = 0; _i2 < categories.Length; _i2++)
            {
                writer.WriteByte((byte)categories[_i2]);
            }

            writer.WriteUTF((string)description);
        }
        public override void Deserialize(IDataReader reader)
        {
            uint _val2 = 0;
            targetId = (double)reader.ReadDouble();
            if (targetId < -9007199254740992 || targetId > 9007199254740992)
            {
                throw new System.Exception("Forbidden value (" + targetId + ") on element of ReportRequestMessage.targetId.");
            }

            uint _categoriesLen = (uint)(reader.ReadUShort());
            categories = new byte[_categoriesLen];
            for (uint _i2 = 0; _i2 < _categoriesLen; _i2++)
            {
                _val2 = (uint)(reader.ReadByte());
                if (_val2 < 0)
                {
                    throw new System.Exception("Forbidden value (" + _val2 + ") on elements of categories.");
                }

                categories[_i2] = (byte)_val2;
            }

            description = (string)reader.ReadUTF();
        }

    }
}


