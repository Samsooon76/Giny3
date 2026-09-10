using System.Collections.Generic;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;

namespace Giny.Protocol.Types
{
    public class AchievementStartedObjective : AchievementObjective
    {
        public new const ushort Id = 5360;
        public override ushort TypeId => Id;

        public long value;

        public AchievementStartedObjective()
        {
        }
        public AchievementStartedObjective(long value, int id, long maxValue)
        {
            this.value = value;
            this.id = id;
            this.maxValue = maxValue;
        }
        public override void Serialize(IDataWriter writer)
        {
            base.Serialize(writer);
            if (value < 0 || value > 9007199254740992)
            {
                throw new System.Exception("Forbidden value (" + value + ") on element value.");
            }

            writer.WriteVarLong((long)value);
        }
        public override void Deserialize(IDataReader reader)
        {
            base.Deserialize(reader);
            value = (long)reader.ReadVarUhLong();
            if (value < 0 || value > 9007199254740992)
            {
                throw new System.Exception("Forbidden value (" + value + ") on element of AchievementStartedObjective.value.");
            }

        }


    }
}


