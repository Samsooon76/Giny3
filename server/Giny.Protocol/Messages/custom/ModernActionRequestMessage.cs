using Giny.Core.IO.Interfaces;
using Giny.Core.Network.Messages;
namespace Giny.Protocol.Messages
{
    public sealed class ModernActionRequestMessage : NetworkMessage
    {
        public const ushort Id = 16378;
        public override ushort MessageId => Id;
        public string actionJson = "{}";
        public ModernActionRequestMessage() { }
        public ModernActionRequestMessage(string json) => actionJson = json;
        public override void Serialize(IDataWriter writer) => writer.WriteUTF(actionJson);
        public override void Deserialize(IDataReader reader) => actionJson = reader.ReadUTF();
    }
}
