using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class SurrenderStateMessage : NetworkMessage
    {
        public const ushort Id = 6944;
        public override ushort MessageId => Id;

        public bool canSurrender;
        public bool permitVote;

        public SurrenderStateMessage()
        {
        }
        public SurrenderStateMessage(bool canSurrender, bool permitVote)
        {
            this.canSurrender = canSurrender;
            this.permitVote = permitVote;
        }
        public override void Serialize(IDataWriter writer)
        {
            byte _box0 = 0;
            _box0 = BooleanByteWrapper.SetFlag(_box0, 0, canSurrender);
            _box0 = BooleanByteWrapper.SetFlag(_box0, 1, permitVote);
            writer.WriteByte((byte)_box0);
        }
        public override void Deserialize(IDataReader reader)
        {
            byte _box0 = (byte)(reader.ReadByte());
            canSurrender = BooleanByteWrapper.GetFlag(_box0, 0);
            permitVote = BooleanByteWrapper.GetFlag(_box0, 1);
        }

    }
}


