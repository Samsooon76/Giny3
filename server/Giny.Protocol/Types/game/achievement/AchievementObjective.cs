using System.Collections.Generic;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;

namespace Giny.Protocol.Types
{
    public class AchievementObjective
    {
        public const ushort Id = 2341;
        public virtual ushort TypeId => Id;

        public int id;
        public long maxValue;

        public AchievementObjective()
        {
        }
        public AchievementObjective(int id, long maxValue)
        {
            this.id = id;
            this.maxValue = maxValue;
        }
        public virtual void Serialize(IDataWriter writer)
        {
            if (id < 0)
            {
                throw new System.Exception("Forbidden value (" + id + ") on element id.");
            }

            writer.WriteVarInt((int)id);
            if (maxValue < 0 || maxValue > 9007199254740992)
            {
                throw new System.Exception("Forbidden value (" + maxValue + ") on element maxValue.");
            }

            writer.WriteVarLong((long)maxValue);
        }
        public virtual void Deserialize(IDataReader reader)
        {
            id = (int)reader.ReadVarUhInt();
            if (id < 0)
            {
                throw new System.Exception("Forbidden value (" + id + ") on element of AchievementObjective.id.");
            }

            maxValue = (long)reader.ReadVarUhLong();
            if (maxValue < 0 || maxValue > 9007199254740992)
            {
                throw new System.Exception("Forbidden value (" + maxValue + ") on element of AchievementObjective.maxValue.");
            }

        }


    }
}


