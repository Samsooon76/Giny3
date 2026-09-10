import { afterEach, expect, it, vi } from 'vitest'
import { FrameReplies } from './FrameReplies'
import type { GinyFrame } from './frameCodec'
const frame = (messageId: number): GinyFrame => ({ messageId, payload: new Uint8Array([messageId]) })
afterEach(() => vi.useRealTimers())
it('preserves matching FIFO replies while discarding only stale movement responses', async () => {
  const replies = new FrameReplies(), first = frame(1), second = frame(2)
  replies.queue(first); replies.queue(frame(3)); replies.queue(second)
  replies.discard(3)
  expect(replies.queuedCount).toBe(2)
  expect(await replies.read([2], 50)).toBe(second)
  expect(await replies.read([1], 50)).toBe(first)
  expect(replies.queuedCount).toBe(0)
})
it('delivers to one waiter at a time and removes its deadline before callbacks', async () => {
  vi.useFakeTimers()
  const replies = new FrameReplies(), value = frame(2)
  const first = replies.read([1, 2], 50), second = replies.read([2], 50)
  replies.take(2)?.(value)
  expect(await first).toBe(value)
  expect(vi.getTimerCount()).toBe(1)
  replies.take(2)?.(value)
  expect(await second).toBe(value)
  expect(vi.getTimerCount()).toBe(0)
  expect(replies.take(2)).toBeUndefined()
})
it('removes expired waiters and keeps the protocol timeout message', async () => {
  vi.useFakeTimers()
  const replies = new FrameReplies()
  const result = expect(replies.read([4944, 277], 5000)).rejects.toThrow('Timeout Giny (4944, 277).')
  await vi.advanceTimersByTimeAsync(5000)
  await result
  expect(replies.take(4944)).toBeUndefined()
  expect(vi.getTimerCount()).toBe(0)
})
it('rejects all pending replies on disconnect without leaving timers', async () => {
  vi.useFakeTimers()
  const replies = new FrameReplies(), error = new Error('Disconnected')
  const results = [expect(replies.read([1], 50)).rejects.toBe(error), expect(replies.read([2], 50)).rejects.toBe(error)]
  replies.fail(error)
  await Promise.all(results)
  expect(vi.getTimerCount()).toBe(0)
  expect(replies.take(1)).toBeUndefined()
})
