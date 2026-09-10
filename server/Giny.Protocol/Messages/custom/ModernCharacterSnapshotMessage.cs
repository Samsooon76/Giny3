using Giny.Core.IO.Interfaces;
using Giny.Core.Network.Messages;

namespace Giny.Protocol.Messages
{
    /// <summary>
    /// Server-authored JSON projection of the live character, account and HUD
    /// stats. Every field is taken from the current World session — nothing is
    /// invented for the web client.
    /// </summary>
    public sealed class ModernCharacterSnapshotMessage : NetworkMessage
    {
        public const ushort Id = 16380;
        public override ushort MessageId => Id;

        public string snapshotJson = "{}";

        public ModernCharacterSnapshotMessage() { }
        public ModernCharacterSnapshotMessage(string snapshotJson) => this.snapshotJson = snapshotJson;

        public override void Serialize(IDataWriter writer) => Giny.Protocol.Custom.ModernJsonPayload.Write(writer, snapshotJson);
        public override void Deserialize(IDataReader reader) => snapshotJson = Giny.Protocol.Custom.ModernJsonPayload.Read(reader);
    }
}
