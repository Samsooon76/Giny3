using Giny.Core.IO.Interfaces;
using Giny.Core.Network.Messages;

namespace Giny.Protocol.Messages
{
    /// <summary>Requests the normalized map state used by the modern client.</summary>
    public sealed class ModernMapSnapshotRequestMessage : NetworkMessage
    {
        public const ushort Id = 16383;
        public override ushort MessageId => Id;

        public override void Serialize(IDataWriter writer) { }
        public override void Deserialize(IDataReader reader) { }
    }
}
