using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class UpdateRecruitmentInformationMessage : NetworkMessage
    {
        public const ushort Id = 691;
        public override ushort MessageId => Id;

        public GuildRecruitmentInformation recruitmentData;

        public UpdateRecruitmentInformationMessage()
        {
        }
        public UpdateRecruitmentInformationMessage(GuildRecruitmentInformation recruitmentData)
        {
            this.recruitmentData = recruitmentData;
        }
        public override void Serialize(IDataWriter writer)
        {
            recruitmentData.Serialize(writer);
        }
        public override void Deserialize(IDataReader reader)
        {
            recruitmentData = new GuildRecruitmentInformation();
            recruitmentData.Deserialize(reader);
        }

    }
}


