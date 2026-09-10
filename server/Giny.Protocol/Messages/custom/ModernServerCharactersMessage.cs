using Giny.Core.IO.Interfaces;
using Giny.Core.Network.Messages;

namespace Giny.Protocol.Messages
{
    /// <summary>Account-scoped character portraits for the server selection screen.</summary>
    public sealed class ModernServerCharactersMessage : NetworkMessage
    {
        public const ushort Id = 16374;
        public override ushort MessageId => Id;

        public string snapshotJson = "{}";

        public ModernServerCharactersMessage() { }
        public ModernServerCharactersMessage(string snapshotJson) => this.snapshotJson = snapshotJson;

        public override void Serialize(IDataWriter writer) => Giny.Protocol.Custom.ModernJsonPayload.Write(writer, snapshotJson);
        public override void Deserialize(IDataReader reader) => snapshotJson = Giny.Protocol.Custom.ModernJsonPayload.Read(reader);
    }
}
