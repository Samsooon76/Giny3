using System.Collections.Generic;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;

namespace Giny.Protocol.Types
{
    public class ArenaLeagueRanking
    {
        public const ushort Id = 3976;
        public virtual ushort TypeId => Id;

        public int rating;
        public short leagueId;
        public int ladderPosition;

        public ArenaLeagueRanking()
        {
        }
        public ArenaLeagueRanking(int rating, short leagueId, int ladderPosition)
        {
            this.rating = rating;
            this.leagueId = leagueId;
            this.ladderPosition = ladderPosition;
        }
        public virtual void Serialize(IDataWriter writer)
        {
            if (rating < 0 || rating > 20000)
            {
                throw new System.Exception("Forbidden value (" + rating + ") on element rating.");
            }

            writer.WriteInt((int)rating);
            writer.WriteVarShort((short)leagueId);
            writer.WriteInt((int)ladderPosition);
        }
        public virtual void Deserialize(IDataReader reader)
        {
            rating = (int)reader.ReadInt();
            if (rating < 0 || rating > 20000)
            {
                throw new System.Exception("Forbidden value (" + rating + ") on element of ArenaLeagueRanking.rating.");
            }

            leagueId = (short)reader.ReadVarShort();
            ladderPosition = (int)reader.ReadInt();
        }


    }
}


