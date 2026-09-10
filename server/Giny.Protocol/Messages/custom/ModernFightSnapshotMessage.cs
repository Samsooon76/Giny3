using Giny.Core.IO.Interfaces;
using Giny.Core.Network.Messages;

namespace Giny.Protocol.Messages
{
    /// <summary>
    /// Server-authored JSON projection of the live fight state, fighters,
    /// timeline, and current spell / weapon sequence actions.
    /// </summary>
    public sealed class ModernFightSnapshotMessage : NetworkMessage
    {
        public const ushort Id = 16379;
        public override ushort MessageId => Id;

        public string snapshotJson = "{}";

        public ModernFightSnapshotMessage() { }
        public ModernFightSnapshotMessage(string snapshotJson) => this.snapshotJson = snapshotJson;

        public override void Serialize(IDataWriter writer) => Giny.Protocol.Custom.ModernJsonPayload.Write(writer, snapshotJson);
        public override void Deserialize(IDataReader reader) => snapshotJson = Giny.Protocol.Custom.ModernJsonPayload.Read(reader);
    }
}
