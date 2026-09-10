using Giny.Core.IO.Interfaces;
using Giny.Core.Network.IPC;
using Giny.Protocol.Custom;
namespace Giny.Protocol.IPC.Messages
{
    public sealed class IPCServerCharactersMessage : IPCMessage
    {
        public const ushort Id = 16014;
        public override ushort MessageId => Id;
        public int accountId;
        public string json = "[]";
        public IPCServerCharactersMessage() { }
        public IPCServerCharactersMessage(int accountId, string json) { this.accountId = accountId; this.json = json; }
        public override void Serialize(IDataWriter writer) { writer.WriteInt(accountId); ModernJsonPayload.Write(writer, json); }
        public override void Deserialize(IDataReader reader) { accountId = reader.ReadInt(); json = ModernJsonPayload.Read(reader); }
    }
}
