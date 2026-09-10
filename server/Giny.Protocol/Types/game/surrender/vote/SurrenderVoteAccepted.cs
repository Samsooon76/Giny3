using System.Collections.Generic;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;

namespace Giny.Protocol.Types
{
    public class SurrenderVoteAccepted : SurrenderVoteResponse
    {
        public new const ushort Id = 8687;
        public override ushort TypeId => Id;


        public SurrenderVoteAccepted()
        {
        }
        public override void Serialize(IDataWriter writer)
        {
        }
        public override void Deserialize(IDataReader reader)
        {
        }


    }
}


