using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Giny.Core.IO;
using Giny.Core.Network;
using Giny.Core.Network.Messages;
using Xunit;

namespace Giny.World.Tests;

public class NetworkReliabilityTests
{
    private static byte[] Frame(byte[] payload, bool sequence = true, bool ipc = false)
    {
        using var writer = new BigEndianWriter();
        var lengthBytes = NetworkMessage.ComputeTypeLen(payload.Length);
        writer.WriteUShort((ushort)((42 << 2) | lengthBytes));
        if (sequence) writer.WriteUInt(7);
        for (int i = lengthBytes - 1; i >= 0; --i) writer.WriteByte((byte)(payload.Length >> (8 * i)));
        writer.WriteBytes(payload);
        if (ipc) { writer.WriteShort(123); writer.WriteBoolean(true); }
        return writer.Data;
    }

    private sealed class ReceivingClient : Client
    {
        public readonly TaskCompletionSource<bool> Received = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int count;
        public ReceivingClient(System.Net.Sockets.Socket socket) : base(socket) { }
        public override void OnMessageReceived(NetworkMessage message) { if (++count == 2) Received.TrySetResult(true); }
        public override void OnMessageUnhandled(NetworkMessage message) { }
        public override void OnHandlingError(NetworkMessage message, Delegate handler, Exception ex) => Received.TrySetException(ex);
        public override void OnConnectionClosed() => Received.TrySetException(new Exception("Closed before both frames"));
        public override void OnConnected() { }
        public override void OnDisconnected() { }
        public override void OnFailToConnect(Exception ex) => Received.TrySetException(ex);
        public override void OnSended(IAsyncResult result) { }
    }

    [Fact]
    public async Task SocketReceiveRetainsPartialHeaderAndGrowsForLargePayload()
    {
        using var listener = new System.Net.Sockets.Socket(System.Net.Sockets.AddressFamily.InterNetwork, System.Net.Sockets.SocketType.Stream, System.Net.Sockets.ProtocolType.Tcp);
        listener.Bind(new System.Net.IPEndPoint(System.Net.IPAddress.Loopback, 0));
        listener.Listen(1);
        using var sender = new System.Net.Sockets.Socket(System.Net.Sockets.AddressFamily.InterNetwork, System.Net.Sockets.SocketType.Stream, System.Net.Sockets.ProtocolType.Tcp);
        var accepted = listener.AcceptAsync();
        await sender.ConnectAsync(listener.LocalEndPoint!);
        using var receiver = new ReceivingClient(await accepted);
        var bytes = Frame(new byte[] { 1, 2, 3 }).Concat(Frame(new byte[70000])).ToArray();
        // Split the header from the rest, then exercise buffer growth beyond 8192 bytes.
        await sender.SendAsync(bytes.AsMemory(0, 1), System.Net.Sockets.SocketFlags.None);
        await Task.Delay(30);
        int offset = 1;
        while (offset < bytes.Length)
            offset += await sender.SendAsync(bytes.AsMemory(offset), System.Net.Sockets.SocketFlags.None);
        await receiver.Received.Task.WaitAsync(TimeSpan.FromSeconds(5));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(4)]
    [InlineData(256)]
    [InlineData(65536)]
    public void EveryTruncationWaitsWithoutConsumingOrInventingBytes(int size)
    {
        var payload = Enumerable.Range(0, size).Select(i => (byte)i).ToArray();
        var frame = Frame(payload);
        // All header boundaries plus payload boundaries, including a full frame > receive buffer.
        var cuts = size < 300 ? Enumerable.Range(0, frame.Length) : new[] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 8192, frame.Length - 1 };
        foreach (var cut in cuts)
        {
            using var stream = new MemoryStream(frame, 0, cut, false);
            using var reader = new BigEndianReader(stream);
            Assert.False(new MessagePart().Build(reader));
            Assert.Equal(0, reader.Position);
        }
        using var complete = new BigEndianReader(frame);
        var part = new MessagePart();
        Assert.True(part.Build(complete));
        Assert.Equal(payload, part.Data);
        Assert.Equal(frame.Length, complete.Position);
    }

    [Fact]
    public void CoalescedFramesLeaveTheNextFrameIntact()
    {
        var first = Frame(new byte[] { 0xAA, 0xBB });
        var second = Frame(new byte[] { 3, 4, 5 });
        using var reader = new BigEndianReader(first.Concat(second).ToArray());
        Assert.True(new MessagePart().Build(reader));
        Assert.Equal(first.Length, reader.Position);
        var part = new MessagePart();
        Assert.True(part.Build(reader));
        Assert.Equal(new byte[] { 3, 4, 5 }, part.Data);
        Assert.Equal(0, reader.BytesAvailable);
    }

    [Fact]
    public void IpcWaitsForItsTrailerAndHasNoClientSequence()
    {
        var frame = Frame(new byte[] { 9 }, sequence: false, ipc: true);
        for (int cut = 0; cut < frame.Length; cut++)
        {
            using var reader = new BigEndianReader(frame.Take(cut).ToArray());
            Assert.False(new MessagePart().Build(reader, false, 3));
            Assert.Equal(0, reader.Position);
        }
        using var complete = new BigEndianReader(frame);
        var part = new MessagePart();
        Assert.True(part.Build(complete, false, 3));
        Assert.Equal(new byte[] { 9, 0, 123, 1 }, part.Data);
    }

    [Fact]
    public async Task PartialSendsFinishInOrderBeforeCompletion()
    {
        var sent = new List<byte>();
        var completions = new List<object>();
        var done = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var queue = new SendQueue(bytes => {
            lock (sent) sent.Add(bytes.Span[0]);
            return ValueTask.FromResult(1);
        }, state => { completions.Add(state); if (completions.Count == 2) done.SetResult(true); }, ex => done.SetException(ex));
        queue.Enqueue(new byte[] { 1, 2, 3 }, "first");
        queue.Enqueue(new byte[] { 4, 5 }, "second");
        await done.Task.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal(new byte[] { 1, 2, 3, 4, 5 }, sent);
        Assert.Equal(new object[] { "first", "second" }, completions);
    }

    [Fact]
    public async Task SendFailureStopsTheQueueWithoutReportingSuccess()
    {
        var failed = new TaskCompletionSource<Exception>(TaskCreationOptions.RunContinuationsAsynchronously);
        var queue = new SendQueue(_ => ValueTask.FromResult(0), _ => throw new Exception("Unexpected completion"), ex => failed.SetResult(ex));
        queue.Enqueue(new byte[] { 1 }, "first");
        Assert.IsType<InvalidOperationException>(await failed.Task.WaitAsync(TimeSpan.FromSeconds(5)));
        Assert.False(queue.Enqueue(new byte[] { 2 }, "late"));
    }

    [Fact]
    public async Task GracefulCloseWaitsForAllPartialWritesAndRejectsLaterMessages()
    {
        var release = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var sent = new List<byte>();
        var completed = new List<object>();
        var queue = new SendQueue(async bytes => {
            await release.Task;
            sent.Add(bytes.Span[0]);
            return 1;
        }, state => completed.Add(state), _ => { });
        queue.Enqueue(new byte[] { 1, 2, 3 }, "selection");
        queue.Enqueue(new byte[] { 4, 5 }, "last");
        var drained = queue.CompleteAsync();
        Assert.False(drained.IsCompleted);
        Assert.False(queue.Enqueue(new byte[] { 6 }, "late"));
        release.SetResult(true);
        await drained.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal(new byte[] { 1, 2, 3, 4, 5 }, sent);
        Assert.Equal(new object[] { "selection", "last" }, completed);
        await queue.CompleteAsync();
    }

    [Fact]
    public async Task GracefulCloseOnEmptyQueueCompletesAndStopCancelsBlockedDrain()
    {
        var empty = new SendQueue(_ => ValueTask.FromResult(1), _ => { }, _ => { });
        await empty.CompleteAsync().WaitAsync(TimeSpan.FromSeconds(1));
        var blocked = new SendQueue(_ => new ValueTask<int>(new TaskCompletionSource<int>().Task), _ => { }, _ => { });
        blocked.Enqueue(new byte[] { 1 }, "pending");
        var completion = blocked.CompleteAsync();
        blocked.Stop();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => completion);
    }

    [Fact]
    public async Task FinalServerSelectionReplyArrivesBeforeSocketCloses()
    {
        using var listener = new System.Net.Sockets.Socket(System.Net.Sockets.AddressFamily.InterNetwork, System.Net.Sockets.SocketType.Stream, System.Net.Sockets.ProtocolType.Tcp);
        listener.Bind(new System.Net.IPEndPoint(System.Net.IPAddress.Loopback, 0));
        listener.Listen(1);
        using var peer = new System.Net.Sockets.Socket(System.Net.Sockets.AddressFamily.InterNetwork, System.Net.Sockets.SocketType.Stream, System.Net.Sockets.ProtocolType.Tcp);
        var accepted = listener.AcceptAsync();
        await peer.ConnectAsync(listener.LocalEndPoint!);
        using var client = new ReceivingClient(await accepted);
        var message = new Giny.Protocol.Messages.SelectedServerDataMessage(2, "127.0.0.1", new short[] { 5555 }, true, new byte[] { 1, 2, 3 });
        using var writer = new BigEndianWriter();
        message.Pack(writer);
        client.Send(message);
        var closed = client.DisconnectAfterSendAsync();
        using var received = new MemoryStream();
        var buffer = new byte[1024];
        while (true)
        {
            int count = await peer.ReceiveAsync(buffer.AsMemory(), System.Net.Sockets.SocketFlags.None).AsTask().WaitAsync(TimeSpan.FromSeconds(5));
            if (count == 0) break;
            received.Write(buffer, 0, count);
        }
        await closed;
        Assert.Equal(writer.Data, received.ToArray());
    }

    [Fact]
    public void SendBacklogIsBounded()
    {
        var queue = new SendQueue(_ => new ValueTask<int>(new TaskCompletionSource<int>().Task), _ => { }, _ => { }, maximumBytes: 3);
        queue.Enqueue(new byte[] { 1, 2, 3 }, "first");
        Assert.Throws<InvalidOperationException>(() => queue.Enqueue(new byte[] { 4 }, "overflow"));
        queue.Stop();
        Assert.False(queue.Enqueue(Array.Empty<byte>(), "stopped"));
    }
}
