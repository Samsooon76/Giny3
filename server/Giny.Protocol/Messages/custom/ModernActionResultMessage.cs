using Giny.Core.IO.Interfaces;
using Giny.Core.Network.Messages;
namespace Giny.Protocol.Messages
{
    public sealed class ModernActionResultMessage : NetworkMessage
    {
        public const ushort Id = 16377;
        public override ushort MessageId => Id;
        public string resultJson = "{}";
        public ModernActionResultMessage() { }
        public ModernActionResultMessage(string json) => resultJson = json;
        public override void Serialize(IDataWriter writer) => writer.WriteUTF(resultJson);
        public override void Deserialize(IDataReader reader) => resultJson = reader.ReadUTF();
    }
}
