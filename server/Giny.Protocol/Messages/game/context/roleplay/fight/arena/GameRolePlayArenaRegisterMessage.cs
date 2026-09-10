using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class GameRolePlayArenaRegisterMessage : NetworkMessage
    {
        public const ushort Id = 2855;
        public override ushort MessageId => Id;

        public int arenaType;

        public GameRolePlayArenaRegisterMessage()
        {
        }
        public GameRolePlayArenaRegisterMessage(int arenaType)
        {
            this.arenaType = arenaType;
        }
        public override void Serialize(IDataWriter writer)
        {
            writer.WriteInt((int)arenaType);
        }
        public override void Deserialize(IDataReader reader)
        {
            arenaType = (int)reader.ReadInt();
            if (arenaType < 0)
            {
                throw new System.Exception("Forbidden value (" + arenaType + ") on element of GameRolePlayArenaRegisterMessage.arenaType.");
            }

        }

    }
}


