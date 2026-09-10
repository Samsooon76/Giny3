using System.Collections.Generic;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;

namespace Giny.Protocol.Types
{
    public class SurrenderRefusedBeforeVote : SurrenderRefused
    {
        public new const ushort Id = 2726;
        public override ushort TypeId => Id;


        public SurrenderRefusedBeforeVote()
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


