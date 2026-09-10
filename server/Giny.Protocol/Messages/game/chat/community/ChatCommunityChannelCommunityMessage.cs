using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class ChatCommunityChannelCommunityMessage : NetworkMessage
    {
        public const ushort Id = 5839;
        public override ushort MessageId => Id;

        public short communityId;

        public ChatCommunityChannelCommunityMessage()
        {
        }
        public ChatCommunityChannelCommunityMessage(short communityId)
        {
            this.communityId = communityId;
        }
        public override void Serialize(IDataWriter writer)
        {
            writer.WriteShort((short)communityId);
        }
        public override void Deserialize(IDataReader reader)
        {
            communityId = (short)reader.ReadShort();
        }

    }
}


