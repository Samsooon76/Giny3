using Giny.Core.IO.Interfaces;
using Giny.Core.Network.Messages;
namespace Giny.Protocol.Messages
{
    public sealed class ModernServerCharactersRequestMessage : NetworkMessage
    {
        public const ushort Id = 16375;
        public override ushort MessageId => Id;
        public override void Serialize(IDataWriter writer) { }
        public override void Deserialize(IDataReader reader) { }
    }
}
