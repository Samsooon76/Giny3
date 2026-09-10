using Giny.Core.IO.Interfaces;
using Giny.Core.Network.Messages;
namespace Giny.Protocol.Messages
{
    public sealed class ModernModuleStateMessage : NetworkMessage
    {
        public const ushort Id = 16376;
        public override ushort MessageId => Id;
        public string stateJson = "{}";
        public ModernModuleStateMessage() { }
        public ModernModuleStateMessage(string json) => stateJson = json;
        public override void Serialize(IDataWriter writer) => Giny.Protocol.Custom.ModernJsonPayload.Write(writer, stateJson);
        public override void Deserialize(IDataReader reader) => stateJson = Giny.Protocol.Custom.ModernJsonPayload.Read(reader);
    }
}
