using System.Collections.Generic;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;

namespace Giny.Protocol.Types
{
    public class FightDetailedTemporaryBoostEffect : FightTemporaryBoostEffect
    {
        public new const ushort Id = 2061;
        public override ushort TypeId => Id;

        public int param1;
        public int param2;
        public int param3;

        public FightDetailedTemporaryBoostEffect()
        {
        }
        public FightDetailedTemporaryBoostEffect(int param1, int param2, int param3, int uid, double targetId, short turnDuration, byte dispelable, short spellId, int effectId, int parentBoostUid, int delta)
        {
            this.param1 = param1;
            this.param2 = param2;
            this.param3 = param3;
            this.uid = uid;
            this.targetId = targetId;
            this.turnDuration = turnDuration;
            this.dispelable = dispelable;
            this.spellId = spellId;
            this.effectId = effectId;
            this.parentBoostUid = parentBoostUid;
            this.delta = delta;
        }
        public override void Serialize(IDataWriter writer)
        {
            base.Serialize(writer);
            writer.WriteInt((int)param1);
            writer.WriteInt((int)param2);
            writer.WriteInt((int)param3);
        }
        public override void Deserialize(IDataReader reader)
        {
            base.Deserialize(reader);
            param1 = (int)reader.ReadInt();
            param2 = (int)reader.ReadInt();
            param3 = (int)reader.ReadInt();
        }


    }
}


