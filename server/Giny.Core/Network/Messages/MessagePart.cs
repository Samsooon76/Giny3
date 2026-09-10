using Giny.Core.IO;
using System;
using System.IO;

namespace Giny.Core.Network.Messages
{
    /// <summary>Reads one complete frame atomically; incomplete input leaves the cursor unchanged.</summary>
    public class MessagePart
    {
        public const int MaximumPayloadLength = 0xFFFFFF;
        public int? Header { get; private set; }
        public int? MessageId => Header >> 2;
        public int? LengthBytesCount => Header & 3;
        public int? Length { get; private set; }
        public byte[] Data { get; private set; }
        private int trailerLength;
        public bool IsValid => Header.HasValue && Length.HasValue && Data != null
            && Data.Length == Length.Value + trailerLength;

        public bool Build(BigEndianReader reader, bool hasSequence = true, int trailerLength = 0)
        {
            if (IsValid) return true;
            if (trailerLength < 0 || trailerLength > 3) throw new ArgumentOutOfRangeException(nameof(trailerLength));
            var start = reader.Position;
            if (reader.BytesAvailable < 2) return false;
            var header = reader.ReadUShort();
            var lengthBytes = header & 3;
            var sequenceBytes = hasSequence ? 4 : 0;
            if (reader.BytesAvailable < sequenceBytes + lengthBytes)
            {
                reader.Seek((int)start, SeekOrigin.Begin);
                return false;
            }
            if (hasSequence) reader.ReadUInt();
            int length = 0;
            for (int i = 0; i < lengthBytes; i++) length = (length << 8) | reader.ReadByte();
            if (reader.BytesAvailable < length + trailerLength)
            {
                reader.Seek((int)start, SeekOrigin.Begin);
                return false;
            }
            Header = header;
            Length = length;
            this.trailerLength = trailerLength;
            Data = reader.ReadBytes(length + trailerLength);
            return true;
        }
    }
}
