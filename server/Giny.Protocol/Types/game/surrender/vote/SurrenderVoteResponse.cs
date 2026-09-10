using System.Collections.Generic;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;

namespace Giny.Protocol.Types
{
    public class SurrenderVoteResponse
    {
        public const ushort Id = 3674;
        public virtual ushort TypeId => Id;


        public SurrenderVoteResponse()
        {
        }
        public virtual void Serialize(IDataWriter writer)
        {
        }
        public virtual void Deserialize(IDataReader reader)
        {
        }


    }
}


