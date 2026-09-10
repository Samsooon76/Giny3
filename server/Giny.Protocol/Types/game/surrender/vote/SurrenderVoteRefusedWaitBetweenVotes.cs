using System.Collections.Generic;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;

namespace Giny.Protocol.Types
{
    public class SurrenderVoteRefusedWaitBetweenVotes : SurrenderVoteRefused
    {
        public new const ushort Id = 5188;
        public override ushort TypeId => Id;

        public int nextVoteTimestamp;

        public SurrenderVoteRefusedWaitBetweenVotes()
        {
        }
        public SurrenderVoteRefusedWaitBetweenVotes(int nextVoteTimestamp)
        {
            this.nextVoteTimestamp = nextVoteTimestamp;
        }
        public override void Serialize(IDataWriter writer)
        {
            base.Serialize(writer);
            writer.WriteInt((int)nextVoteTimestamp);
        }
        public override void Deserialize(IDataReader reader)
        {
            base.Deserialize(reader);
            nextVoteTimestamp = (int)reader.ReadInt();
        }


    }
}


