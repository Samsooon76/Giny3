using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class GameRolePlayArenaUpdatePlayerInfosMessage : NetworkMessage
    {
        public const ushort Id = 1665;
        public override ushort MessageId => Id;

        public ArenaRankInfos[] arenaRanks;
        public double banEndDate;

        public GameRolePlayArenaUpdatePlayerInfosMessage()
        {
        }
        public GameRolePlayArenaUpdatePlayerInfosMessage(ArenaRankInfos[] arenaRanks, double banEndDate)
        {
            this.arenaRanks = arenaRanks;
            this.banEndDate = banEndDate;
        }
        public override void Serialize(IDataWriter writer)
        {
            writer.WriteShort((short)arenaRanks.Length);
            for (uint _i1 = 0; _i1 < arenaRanks.Length; _i1++)
            {
                (arenaRanks[_i1] as ArenaRankInfos).Serialize(writer);
            }

            if (banEndDate < -9007199254740992 || banEndDate > 9007199254740992)
            {
                throw new System.Exception("Forbidden value (" + banEndDate + ") on element banEndDate.");
            }

            writer.WriteDouble((double)banEndDate);
        }
        public override void Deserialize(IDataReader reader)
        {
            ArenaRankInfos _item1 = null;
            uint _arenaRanksLen = (uint)(reader.ReadUShort());
            arenaRanks = new ArenaRankInfos[_arenaRanksLen];
            for (uint _i1 = 0; _i1 < _arenaRanksLen; _i1++)
            {
                _item1 = new ArenaRankInfos();
                _item1.Deserialize(reader);
                arenaRanks[_i1] = _item1;
            }

            banEndDate = (double)reader.ReadDouble();
            if (banEndDate < -9007199254740992 || banEndDate > 9007199254740992)
            {
                throw new System.Exception("Forbidden value (" + banEndDate + ") on element of GameRolePlayArenaUpdatePlayerInfosMessage.banEndDate.");
            }

        }

    }
}


