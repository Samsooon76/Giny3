using System.Collections.Generic;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;

namespace Giny.Protocol.Types
{
    public class SurrenderVoteRefusedBeforeTurn : SurrenderVoteRefused
    {
        public new const ushort Id = 9709;
        public override ushort TypeId => Id;

        public int minTurnForSurrenderVote;

        public SurrenderVoteRefusedBeforeTurn()
        {
        }
        public SurrenderVoteRefusedBeforeTurn(int minTurnForSurrenderVote)
        {
            this.minTurnForSurrenderVote = minTurnForSurrenderVote;
        }
        public override void Serialize(IDataWriter writer)
        {
            base.Serialize(writer);
            writer.WriteInt((int)minTurnForSurrenderVote);
        }
        public override void Deserialize(IDataReader reader)
        {
            base.Deserialize(reader);
            minTurnForSurrenderVote = (int)reader.ReadInt();
        }


    }
}


