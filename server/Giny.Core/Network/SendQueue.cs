using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Giny.Core.Network
{
    /// <summary>One bounded FIFO per connection; retains each buffer until every byte is sent.</summary>
    public sealed class SendQueue
    {
        private readonly object sync = new object();
        private readonly Queue<(byte[] bytes, object state)> pending = new();
        private readonly Func<ReadOnlyMemory<byte>, ValueTask<int>> send;
        private readonly Action<object> completed;
        private readonly Action<Exception> failed;
        private readonly int maximumBytes;
        private readonly int maximumMessages;
        private int bufferedBytes;
        private bool running;
        private bool stopped;
        private bool completing;
        private readonly TaskCompletionSource<bool> drained = new(TaskCreationOptions.RunContinuationsAsynchronously);

        /// <summary>Reject new writes and finish every accepted frame before closing.</summary>
        public Task CompleteAsync()
        {
            lock (sync)
            {
                completing = true;
                if (!stopped && !running) drained.TrySetResult(true);
                return drained.Task;
            }
        }

        public SendQueue(Func<ReadOnlyMemory<byte>, ValueTask<int>> send, Action<object> completed,
            Action<Exception> failed, int maximumBytes = 32 * 1024 * 1024, int maximumMessages = 1024)
        {
            this.send = send;
            this.completed = completed;
            this.failed = failed;
            this.maximumBytes = maximumBytes;
            this.maximumMessages = maximumMessages;
        }

        public bool Enqueue(byte[] bytes, object state)
        {
            lock (sync)
            {
                if (stopped || completing) return false;
                if (bytes.Length > maximumBytes - bufferedBytes || pending.Count >= maximumMessages)
                    throw new InvalidOperationException("Connection send backlog exceeded its limit.");
                pending.Enqueue((bytes, state));
                bufferedBytes += bytes.Length;
                if (!running)
                {
                    running = true;
                    _ = Task.Run(Drain);
                }
                return true;
            }
        }

        public void Stop()
        {
            lock (sync)
            {
                stopped = true;
                drained.TrySetCanceled();
                pending.Clear();
                bufferedBytes = 0;
            }
        }

        private async Task Drain()
        {
            try
            {
                while (true)
                {
                    (byte[] bytes, object state) item;
                    lock (sync)
                    {
                        if (stopped || pending.Count == 0)
                        {
                            running = false;
                            if (!stopped && completing) drained.TrySetResult(true);
                            return;
                        }
                        item = pending.Peek();
                    }
                    int offset = 0;
                    while (offset < item.bytes.Length)
                    {
                        lock (sync) { if (stopped) return; }
                        int count = await send(item.bytes.AsMemory(offset)).ConfigureAwait(false);
                        if (count <= 0 || count > item.bytes.Length - offset)
                            throw new InvalidOperationException("Socket did not complete the pending send.");
                        offset += count;
                    }
                    lock (sync)
                    {
                        if (stopped) return;
                        pending.Dequeue();
                        bufferedBytes -= item.bytes.Length;
                    }
                    completed(item.state);
                }
            }
            catch (Exception ex)
            {
                Stop();
                failed(ex);
            }
        }
    }
}
