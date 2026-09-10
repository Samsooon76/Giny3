using Giny.Core.IO;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;

namespace Giny.Core.Network
{
    public abstract class TcpClient : IDisposable
    {
        public const int BUFFER_LENGTH = 8192;

        protected Socket Socket
        {
            get;
            set;
        }

        protected byte[] Buffer
        {
            get;
            set;
        }

        protected int BufferPosition
        {
            get;
            set;
        }
        public IPEndPoint? EndPoint
        {
            get
            {
                return Socket == null ? null : Socket.RemoteEndPoint as IPEndPoint;
            }
        }
        public string Ip
        {
            get
            {
                if (EndPoint == null)
                {
                    return null;
                }
                return EndPoint.Address.ToString();
            }
        }
        public bool Connected
        {
            get
            {
                return Socket != null && Socket.Connected;
            }
        }

        public TcpClient()
        {
            Socket = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
            Buffer = new byte[BUFFER_LENGTH];
        }
        public TcpClient(Socket socket)
        {
            this.Buffer = new byte[BUFFER_LENGTH];
            this.Socket = socket;
        }

        public abstract void OnConnectionClosed();

        public abstract void OnConnected();

        public abstract void OnDisconnected();


        public abstract void OnFailToConnect(Exception ex);

        protected abstract void OnDataArrival(int dataSize);

        public abstract void OnSended(IAsyncResult result);

        public void Connect(string host, int port)
        {
            Socket?.BeginConnect(new IPEndPoint(IPAddress.Parse(host), port), new AsyncCallback(OnConnectionResulted), Socket);
        }

        public void OnConnectionResulted(IAsyncResult result)
        {
            try
            {
                Socket.EndConnect(result);
                BeginReceive();
                OnConnected();
            }
            catch (Exception ex)
            {
                OnFailToConnect(ex);
            }
        }
        protected void BeginReceive()
        {
            try
            {
                // Grow only when an incomplete frame fills the receive buffer. The protocol
                // has at most a 24-bit payload, a 9-byte client header and a 3-byte IPC trailer.
                const int maximumFrameLength = Messages.MessagePart.MaximumPayloadLength + 12;
                if (BufferPosition == Buffer.Length)
                {
                    if (Buffer.Length >= maximumFrameLength)
                        throw new InvalidOperationException("Receive frame exceeds the protocol limit.");
                    var expanded = new byte[Math.Min(Buffer.Length * 2, maximumFrameLength)];
                    System.Buffer.BlockCopy(Buffer, 0, expanded, 0, BufferPosition);
                    Buffer = expanded;
                }
                Socket?.BeginReceive(Buffer, BufferPosition, Buffer.Length - BufferPosition, SocketFlags.None, OnReceived, null);
            }
            catch (Exception ex)
            {
                Logger.Write("Unable to receive from client " + ex, Channels.Warning);
                Disconnect();
            }
        }
        public void OnReceived(IAsyncResult result)
        {
            if (Socket == null)
            {
                return;
            }

            int size = 0;
            try
            {
                size = Socket.EndReceive(result);

                if (size == 0)
                {
                    Dispose();
                    OnConnectionClosed();
                    return;
                }

            }
            catch
            {
                Dispose();
                OnConnectionClosed();
                return;
            }

            try
            {
                OnDataArrival(size);
                BeginReceive();
            }
            catch (Exception ex)
            {
                Logger.Write("Unable to process client data: " + ex, Channels.Warning);
                Disconnect();
            }
        }
        public void Disconnect()
        {
            if (Socket != null)
            {
                Dispose();

                try
                {
                    OnDisconnected();
                }
                catch (Exception ex)
                {
                    Logger.Write("Unable to disconnect client : " + ex);
                }
            }
        }
        public virtual void Dispose()
        {
            if (Socket != null)
            {
                Socket.Dispose();
                Socket = null;
            }
        }
    }
}
