using System;
using System.IO;
using Giny.Core.IO;
using Giny.Protocol.Custom;
using Xunit;

namespace Giny.World.Tests
{
    public class ModernJsonTests
    {
        [Theory]
        [InlineData(10)]
        [InlineData(65534)]
        [InlineData(65535)]
        [InlineData(70000)]
        public void ProjectionRoundTripsAtUtfBoundary(int length)
        {
            string json = new string('x', length);
            using var writer = new BigEndianWriter();
            ModernJsonPayload.Write(writer, json);
            using var reader = new BigEndianReader(writer.Data);
            Assert.Equal(json, ModernJsonPayload.Read(reader));
            Assert.Equal(0, reader.BytesAvailable);
            Assert.Equal(length + (length < 65535 ? 2 : 6), writer.Data.Length);
        }
        [Fact]
        public void Utf8TextIsNotTruncatedAndInvalidLengthsAreRejected()
        {
            string json = new string('é', 40000);
            using var writer = new BigEndianWriter();
            ModernJsonPayload.Write(writer, json);
            using var reader = new BigEndianReader(writer.Data);
            Assert.Equal(json, ModernJsonPayload.Read(reader));
            using var bad = new BigEndianReader(new byte[] { 255, 255, 127, 255, 255, 255 });
            Assert.Throws<InvalidDataException>(() => ModernJsonPayload.Read(bad));
        }
    }
}
