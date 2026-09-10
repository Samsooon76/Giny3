using System.Collections.Generic;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;

namespace Giny.Protocol.Types
{
    public class AchievementPioneerRank
    {
        public const ushort Id = 6487;
        public virtual ushort TypeId => Id;

        public int achievementId;
        public int pioneerRank;

        public AchievementPioneerRank()
        {
        }
        public AchievementPioneerRank(int achievementId, int pioneerRank)
        {
            this.achievementId = achievementId;
            this.pioneerRank = pioneerRank;
        }
        public virtual void Serialize(IDataWriter writer)
        {
            if (achievementId < 0)
            {
                throw new System.Exception("Forbidden value (" + achievementId + ") on element achievementId.");
            }

            writer.WriteVarInt((int)achievementId);
            if (pioneerRank < 0)
            {
                throw new System.Exception("Forbidden value (" + pioneerRank + ") on element pioneerRank.");
            }

            writer.WriteVarInt((int)pioneerRank);
        }
        public virtual void Deserialize(IDataReader reader)
        {
            achievementId = (int)reader.ReadVarUhInt();
            if (achievementId < 0)
            {
                throw new System.Exception("Forbidden value (" + achievementId + ") on element of AchievementPioneerRank.achievementId.");
            }

            pioneerRank = (int)reader.ReadVarUhInt();
            if (pioneerRank < 0)
            {
                throw new System.Exception("Forbidden value (" + pioneerRank + ") on element of AchievementPioneerRank.pioneerRank.");
            }

        }


    }
}


