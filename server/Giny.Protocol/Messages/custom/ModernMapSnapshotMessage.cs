using Giny.Core.IO.Interfaces;
using Giny.Core.Network.Messages;

namespace Giny.Protocol.Messages
{
    /// <summary>
    /// Server-authored JSON projection of the live map. It deliberately carries
    /// no fabricated state: every actor field comes from the current MapInstance.
    /// </summary>
    public sealed class ModernMapSnapshotMessage : NetworkMessage
    {
        public const ushort Id = 16382;
        public override ushort MessageId => Id;

        public string snapshotJson = "{}";

        public ModernMapSnapshotMessage() { }
        public ModernMapSnapshotMessage(string snapshotJson) => this.snapshotJson = snapshotJson;

        public override void Serialize(IDataWriter writer) => Giny.Protocol.Custom.ModernJsonPayload.Write(writer, snapshotJson);
        public override void Deserialize(IDataReader reader) => snapshotJson = Giny.Protocol.Custom.ModernJsonPayload.Read(reader);
    }
}
