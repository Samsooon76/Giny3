using System.Collections.Generic;
using Giny.Core.Network.Messages;
using Giny.Protocol.Types;
using Giny.Core.IO.Interfaces;
using Giny.Protocol;
using Giny.Protocol.Enums;
using Version = Giny.Protocol.Types.Version;

namespace Giny.Protocol.Messages
{
    public class JobCrafterDirectoryDefineSettingsMessage : NetworkMessage
    {
        public const ushort Id = 5859;
        public override ushort MessageId => Id;

        public JobCrafterDirectorySettings settings;

        public JobCrafterDirectoryDefineSettingsMessage()
        {
        }
        public JobCrafterDirectoryDefineSettingsMessage(JobCrafterDirectorySettings settings)
        {
            this.settings = settings;
        }
        public override void Serialize(IDataWriter writer)
        {
            settings.Serialize(writer);
        }
        public override void Deserialize(IDataReader reader)
        {
            settings = new JobCrafterDirectorySettings();
            settings.Deserialize(reader);
        }

    }
}


