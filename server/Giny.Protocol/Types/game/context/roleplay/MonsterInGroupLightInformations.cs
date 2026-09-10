using System.Collections.Generic;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;

namespace Giny.Protocol.Types
{
    public class MonsterInGroupLightInformations
    {
        public const ushort Id = 1537;
        public virtual ushort TypeId => Id;

        public int genericId;
        public byte grade;
        public short level;
        /// <summary>
        /// Giny extension. The patched client consumes this byte and renders it;
        /// ordinary Dofus clients must not be used with the Giny map patch.
        /// </summary>
        public byte pokefusStatus;

        public MonsterInGroupLightInformations()
        {
        }
        public MonsterInGroupLightInformations(int genericId, byte grade, short level, byte pokefusStatus = 0)
        {
            this.genericId = genericId;
            this.grade = grade;
            this.level = level;
            this.pokefusStatus = pokefusStatus;
        }
        public virtual void Serialize(IDataWriter writer)
        {
            writer.WriteInt((int)genericId);
            if (grade < 0)
            {
                throw new System.Exception("Forbidden value (" + grade + ") on element grade.");
            }

            writer.WriteByte((byte)grade);
            if (level < 0)
            {
                throw new System.Exception("Forbidden value (" + level + ") on element level.");
            }

            writer.WriteShort((short)level);
            writer.WriteByte(pokefusStatus);
        }
        public virtual void Deserialize(IDataReader reader)
        {
            genericId = (int)reader.ReadInt();
            grade = (byte)reader.ReadByte();
            if (grade < 0)
            {
                throw new System.Exception("Forbidden value (" + grade + ") on element of MonsterInGroupLightInformations.grade.");
            }

            level = (short)reader.ReadShort();
            if (level < 0)
            {
                throw new System.Exception("Forbidden value (" + level + ") on element of MonsterInGroupLightInformations.level.");
            }

            pokefusStatus = (byte)reader.ReadByte();

        }


    }
}

