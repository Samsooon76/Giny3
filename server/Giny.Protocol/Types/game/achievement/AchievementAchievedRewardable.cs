using System.Collections.Generic;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;

namespace Giny.Protocol.Types
{
    public class AchievementAchievedRewardable : AchievementAchieved
    {
        public new const ushort Id = 9874;
        public override ushort TypeId => Id;

        public short finishedLevel;

        public AchievementAchievedRewardable()
        {
        }
        public AchievementAchievedRewardable(short finishedLevel, short id, long achievedBy, int achievedPioneerRank)
        {
            this.finishedLevel = finishedLevel;
            this.id = id;
            this.achievedBy = achievedBy;
            this.achievedPioneerRank = achievedPioneerRank;
        }
        public override void Serialize(IDataWriter writer)
        {
            base.Serialize(writer);
            if (finishedLevel < 0 || finishedLevel > 200)
            {
                throw new System.Exception("Forbidden value (" + finishedLevel + ") on element finishedLevel.");
            }

            writer.WriteVarShort((short)finishedLevel);
        }
        public override void Deserialize(IDataReader reader)
        {
            base.Deserialize(reader);
            finishedLevel = (short)reader.ReadVarUhShort();
            if (finishedLevel < 0 || finishedLevel > 200)
            {
                throw new System.Exception("Forbidden value (" + finishedLevel + ") on element of AchievementAchievedRewardable.finishedLevel.");
            }

        }


    }
}


