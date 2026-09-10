using Giny.Core;
using Giny.Core.IO;
using Giny.Core.Network.Messages;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;

namespace Giny.Core.Network
{
    public abstract class Client : TcpClient
    {
        private readonly SendQueue sendQueue;
        public Client()
        {
            sendQueue = CreateSendQueue();
        }

        private SendQueue CreateSendQueue() => new SendQueue(
            bytes => Socket.SendAsync(bytes, SocketFlags.None),
            state =>
            {
                var completion = new TaskCompletionSource<object>(state);
                completion.SetResult(null);
                OnSended(completion.Task);
            },
            ex => { Logger.Write(ex, Channels.Warning); Disconnect(); });

        public override void Dispose()
        {
            sendQueue?.Stop();
            base.Dispose();
        }
        public Client(Socket socket) : base(socket)
        {
            sendQueue = CreateSendQueue();
            this.BeginReceive();
        }
        public abstract void OnMessageReceived(NetworkMessage message);

        public abstract void OnMessageUnhandled(NetworkMessage message);

        public abstract void OnHandlingError(NetworkMessage message, Delegate handler, Exception ex);

        public virtual void Send(NetworkMessage message)
        {
            if (Socket != null && Socket.Connected)
            {
                try
                {
                    using (var writer = new BigEndianWriter())
                    {
                        message.Pack(writer);
                        sendQueue.Enqueue(writer.Data, message);
                    }
                }
                catch (Exception ex) 
                {
                    Logger.Write(ex, Channels.Warning);
                    Disconnect();
                }
            }
        }
        /// <summary>Flush terminal protocol replies before closing, with a bounded wait.</summary>
        public async Task DisconnectAfterSendAsync()
        {
            try
            {
                await sendQueue.CompleteAsync().WaitAsync(TimeSpan.FromSeconds(5)).ConfigureAwait(false);
                // Send FIN before disposing a socket with an outstanding receive.
                try { Socket?.Shutdown(SocketShutdown.Both); }
                catch (SocketException) { }
                catch (ObjectDisposedException) { }
            }
            catch (OperationCanceledException) { }
            catch (TimeoutException) { }
            finally { Disconnect(); }
        }

        protected virtual bool IsIpcConnection => false;

        protected override void OnDataArrival(int dataSize)
        {
            BufferPosition += dataSize;
            int consumed = 0;
            using (var stream = new System.IO.MemoryStream(Buffer, 0, BufferPosition, false))
            using (var reader = new BigEndianReader(stream))
            {
                while (reader.BytesAvailable > 0)
                {
                    var message = ProtocolMessageManager.BuildMessage(reader, IsIpcConnection);
                    if (message == null) break;
                    consumed = (int)reader.Position;
                    OnMessageReceived(message);
                    if (!Connected) break;
                }
            }
            BufferPosition -= consumed;
            if (consumed > 0 && BufferPosition > 0)
                System.Buffer.BlockCopy(Buffer, consumed, Buffer, 0, BufferPosition);
        }
    }
}
