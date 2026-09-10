using System.IO;
using System.IO.Compression;

namespace Giny.Protocol.Messages
{
    internal static class NetworkDataCompression
    {
        public static byte[] Decompress(byte[] data)
        {
            using var input = new MemoryStream(data);
            using var zlib = new ZLibStream(input, CompressionMode.Decompress);
            using var output = new MemoryStream();
            zlib.CopyTo(output);
            return output.ToArray();
        }
    }
}
