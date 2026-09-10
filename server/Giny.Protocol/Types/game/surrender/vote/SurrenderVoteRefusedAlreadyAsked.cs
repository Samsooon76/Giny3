using System.Collections.Generic;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;

namespace Giny.Protocol.Types
{
    public class SurrenderVoteRefusedAlreadyAsked : SurrenderVoteRefused
    {
        public new const ushort Id = 8978;
        public override ushort TypeId => Id;


        public SurrenderVoteRefusedAlreadyAsked()
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


