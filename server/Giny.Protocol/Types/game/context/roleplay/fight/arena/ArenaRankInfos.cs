using System.Collections.Generic;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;

namespace Giny.Protocol.Types
{
    public class ArenaRankInfos
    {
        public const ushort Id = 2174;
        public virtual ushort TypeId => Id;

        public int arenaType;
        public ArenaLeagueRanking leagueRanking;
        public short bestLeagueId;
        public int bestRating;
        public short dailyVictoryCount;
        public short seasonVictoryCount;
        public short dailyFightcount;
        public short seasonFightcount;
        public short numFightNeededForLadder;

        public ArenaRankInfos()
        {
        }
        public ArenaRankInfos(int arenaType, ArenaLeagueRanking leagueRanking, short bestLeagueId, int bestRating, short dailyVictoryCount, short seasonVictoryCount, short dailyFightcount, short seasonFightcount, short numFightNeededForLadder)
        {
            this.arenaType = arenaType;
            this.leagueRanking = leagueRanking;
            this.bestLeagueId = bestLeagueId;
            this.bestRating = bestRating;
            this.dailyVictoryCount = dailyVictoryCount;
            this.seasonVictoryCount = seasonVictoryCount;
            this.dailyFightcount = dailyFightcount;
            this.seasonFightcount = seasonFightcount;
            this.numFightNeededForLadder = numFightNeededForLadder;
        }
        public virtual void Serialize(IDataWriter writer)
        {
            writer.WriteInt((int)arenaType);
            if (leagueRanking == null)
            {
                writer.WriteByte(0);
            }

            else
            {
                writer.WriteByte(1);
                leagueRanking.Serialize(writer);
            }

            writer.WriteVarShort((short)bestLeagueId);
            if (bestRating < 0 || bestRating > 20000)
            {
                throw new System.Exception("Forbidden value (" + bestRating + ") on element bestRating.");
            }

            writer.WriteInt((int)bestRating);
            if (dailyVictoryCount < 0)
            {
                throw new System.Exception("Forbidden value (" + dailyVictoryCount + ") on element dailyVictoryCount.");
            }

            writer.WriteVarShort((short)dailyVictoryCount);
            if (seasonVictoryCount < 0)
            {
                throw new System.Exception("Forbidden value (" + seasonVictoryCount + ") on element seasonVictoryCount.");
            }

            writer.WriteVarShort((short)seasonVictoryCount);
            if (dailyFightcount < 0)
            {
                throw new System.Exception("Forbidden value (" + dailyFightcount + ") on element dailyFightcount.");
            }

            writer.WriteVarShort((short)dailyFightcount);
            if (seasonFightcount < 0)
            {
                throw new System.Exception("Forbidden value (" + seasonFightcount + ") on element seasonFightcount.");
            }

            writer.WriteVarShort((short)seasonFightcount);
            if (numFightNeededForLadder < 0)
            {
                throw new System.Exception("Forbidden value (" + numFightNeededForLadder + ") on element numFightNeededForLadder.");
            }

            writer.WriteShort((short)numFightNeededForLadder);
        }
        public virtual void Deserialize(IDataReader reader)
        {
            arenaType = (int)reader.ReadInt();
            if (arenaType < 0)
            {
                throw new System.Exception("Forbidden value (" + arenaType + ") on element of ArenaRankInfos.arenaType.");
            }

            if (reader.ReadByte() == 0)
            {
                leagueRanking = null;
            }

            else
            {
                leagueRanking = new ArenaLeagueRanking();
                leagueRanking.Deserialize(reader);
            }

            bestLeagueId = (short)reader.ReadVarShort();
            bestRating = (int)reader.ReadInt();
            if (bestRating < 0 || bestRating > 20000)
            {
                throw new System.Exception("Forbidden value (" + bestRating + ") on element of ArenaRankInfos.bestRating.");
            }

            dailyVictoryCount = (short)reader.ReadVarUhShort();
            if (dailyVictoryCount < 0)
            {
                throw new System.Exception("Forbidden value (" + dailyVictoryCount + ") on element of ArenaRankInfos.dailyVictoryCount.");
            }

            seasonVictoryCount = (short)reader.ReadVarUhShort();
            if (seasonVictoryCount < 0)
            {
                throw new System.Exception("Forbidden value (" + seasonVictoryCount + ") on element of ArenaRankInfos.seasonVictoryCount.");
            }

            dailyFightcount = (short)reader.ReadVarUhShort();
            if (dailyFightcount < 0)
            {
                throw new System.Exception("Forbidden value (" + dailyFightcount + ") on element of ArenaRankInfos.dailyFightcount.");
            }

            seasonFightcount = (short)reader.ReadVarUhShort();
            if (seasonFightcount < 0)
            {
                throw new System.Exception("Forbidden value (" + seasonFightcount + ") on element of ArenaRankInfos.seasonFightcount.");
            }

            numFightNeededForLadder = (short)reader.ReadShort();
            if (numFightNeededForLadder < 0)
            {
                throw new System.Exception("Forbidden value (" + numFightNeededForLadder + ") on element of ArenaRankInfos.numFightNeededForLadder.");
            }

        }


    }
}


