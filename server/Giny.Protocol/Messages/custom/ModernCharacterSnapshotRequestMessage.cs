using Giny.Core.IO.Interfaces;
using Giny.Core.Network.Messages;

namespace Giny.Protocol.Messages
{
    /// <summary>Requests the JSON HUD projection of the live character.</summary>
    public sealed class ModernCharacterSnapshotRequestMessage : NetworkMessage
    {
        public const ushort Id = 16381;
        public override ushort MessageId => Id;

        public override void Serialize(IDataWriter writer) { }
        public override void Deserialize(IDataReader reader) { }
    }
}
