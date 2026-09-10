using System.Collections.Generic;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;

namespace Giny.Protocol.Types
{
    public class CharacterBaseInformations : CharacterMinimalPlusLookInformations
    {
        public new const ushort Id = 4367;
        public override ushort TypeId => Id;

        public bool sex;
        public short prestige;

        public CharacterBaseInformations()
        {
        }
        public CharacterBaseInformations(bool sex, short prestige, long id, string name, short level, EntityLook entityLook, byte breed)
        {
            this.sex = sex;
            this.prestige = prestige;
            this.id = id;
            this.name = name;
            this.level = level;
            this.entityLook = entityLook;
            this.breed = breed;
        }
        public override void Serialize(IDataWriter writer)
        {
            base.Serialize(writer);
            writer.WriteBoolean((bool)sex);
            if (prestige < 0)
            {
                throw new System.Exception("Forbidden value (" + prestige + ") on element prestige.");
            }

            writer.WriteVarShort((short)prestige);
        }
        public override void Deserialize(IDataReader reader)
        {
            base.Deserialize(reader);
            sex = (bool)reader.ReadBoolean();
            prestige = (short)reader.ReadVarShort();
            if (prestige < 0)
            {
                throw new System.Exception("Forbidden value (" + prestige + ") on element of CharacterBaseInformations.prestige.");
            }

        }


    }
}


