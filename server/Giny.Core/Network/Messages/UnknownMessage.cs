using Giny.Core.IO.Interfaces;

namespace Giny.Core.Network.Messages
{
    /// <summary>
    /// Placeholder for a fully-framed client packet whose protocol id is not registered.
    /// Returning this (instead of null) lets the receive loop advance past the frame
    /// without disconnecting the client.
    /// </summary>
    public sealed class UnknownMessage : NetworkMessage
    {
        private readonly ushort _messageId;

        public UnknownMessage(ushort messageId)
        {
            _messageId = messageId;
        }

        public override ushort MessageId => _messageId;

        public override void Serialize(IDataWriter writer)
        {
        }

        public override void Deserialize(IDataReader reader)
        {
        }

        public override string ToString()
        {
            return $"UnknownMessage({_messageId})";
        }
    }
}
