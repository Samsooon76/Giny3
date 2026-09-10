using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class SwitchArenaXpRewardsModeMessage : NetworkMessage
    {
        public const ushort Id = 4870;
        public override ushort MessageId => Id;

        public bool xpRewards;

        public SwitchArenaXpRewardsModeMessage()
        {
        }
        public SwitchArenaXpRewardsModeMessage(bool xpRewards)
        {
            this.xpRewards = xpRewards;
        }
        public override void Serialize(IDataWriter writer)
        {
            writer.WriteBoolean((bool)xpRewards);
        }
        public override void Deserialize(IDataReader reader)
        {
            xpRewards = (bool)reader.ReadBoolean();
        }

    }
}


