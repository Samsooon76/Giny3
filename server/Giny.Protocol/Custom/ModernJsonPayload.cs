using System;
using System.IO;
using System.Text;
using Giny.Core.IO.Interfaces;

namespace Giny.Protocol.Custom
{
    /// <summary>Legacy UTF for small projections, reserved 0xffff marker + int32 for large JSON.</summary>
    public static class ModernJsonPayload
    {
        public const int MaximumBytes = 4 * 1024 * 1024;
        public static void Write(IDataWriter writer, string json)
        {
            var bytes = Encoding.UTF8.GetBytes(json);
            if (bytes.Length > MaximumBytes) throw new InvalidDataException("Modern JSON projection exceeds 4 MiB.");
            if (bytes.Length < ushort.MaxValue) { writer.WriteUTF(json); return; }
            writer.WriteUShort(ushort.MaxValue);
            writer.WriteInt(bytes.Length);
            writer.WriteBytes(bytes);
        }
        public static string Read(IDataReader reader)
        {
            int length = reader.ReadUShort();
            if (length == ushort.MaxValue) length = reader.ReadInt();
            if (length < 0 || length > MaximumBytes || length > reader.BytesAvailable) throw new InvalidDataException("Invalid modern JSON length.");
            return new UTF8Encoding(false, true).GetString(reader.ReadBytes(length));
        }
    }
}
