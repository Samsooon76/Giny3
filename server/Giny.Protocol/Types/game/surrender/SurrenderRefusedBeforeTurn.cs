using System.Collections.Generic;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;

namespace Giny.Protocol.Types
{
    public class SurrenderRefusedBeforeTurn : SurrenderRefused
    {
        public new const ushort Id = 9548;
        public override ushort TypeId => Id;

        public int minTurnForSurrender;

        public SurrenderRefusedBeforeTurn()
        {
        }
        public SurrenderRefusedBeforeTurn(int minTurnForSurrender)
        {
            this.minTurnForSurrender = minTurnForSurrender;
        }
        public override void Serialize(IDataWriter writer)
        {
            base.Serialize(writer);
            writer.WriteInt((int)minTurnForSurrender);
        }
        public override void Deserialize(IDataReader reader)
        {
            base.Deserialize(reader);
            minTurnForSurrender = (int)reader.ReadInt();
        }


    }
}


