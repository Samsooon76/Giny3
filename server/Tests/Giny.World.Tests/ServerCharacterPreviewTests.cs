using Giny.Core.IO;
using Giny.Protocol.IPC.Messages;
using Giny.Protocol.Messages;
using Xunit;
namespace Giny.World.Tests
{
    public class ServerCharacterPreviewTests
    {
        [Fact]
        public void PortraitProjectionPreservesAccountAndUnicodeOverIpc()
        {
            const string json = "[{\"id\":12,\"name\":\"Féca\",\"look\":\"{1|10,2012|1=#e59b68|53}\"}]";
            var message = new IPCServerCharactersMessage(42, json);
            using var writer = new BigEndianWriter();
            message.Serialize(writer);
            using var reader = new BigEndianReader(writer.Data);
            var restored = new IPCServerCharactersMessage();
            restored.Deserialize(reader);
            Assert.Equal(42, restored.accountId);
            Assert.Equal(json, restored.json);
            Assert.Equal(0, reader.BytesAvailable);
        }
        [Fact]
        public void AuthProjectionRoundTripsAndRequestCannotSupplyAnAccount()
        {
            const string json = "{\"servers\":[{\"id\":50,\"characters\":[]}]}";
            using var writer = new BigEndianWriter();
            new ModernServerCharactersMessage(json).Serialize(writer);
            using var reader = new BigEndianReader(writer.Data);
            var restored = new ModernServerCharactersMessage();
            restored.Deserialize(reader);
            Assert.Equal(json, restored.snapshotJson);
            using var request = new BigEndianWriter();
            new ModernServerCharactersRequestMessage().Serialize(request);
            Assert.Empty(request.Data);
        }
    }
}
