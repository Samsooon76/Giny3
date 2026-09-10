import { afterEach, expect, it, vi } from 'vitest'
import { CombatSequencer } from './CombatSequencer'
afterEach(() => vi.useRealTimers())
it('a failed acknowledgement does not poison later presentations', async () => {
  const failed = vi.fn(), next = vi.fn(), queue = new CombatSequencer(() => {}, failed)
  queue.enqueue(async () => {}, () => { throw new Error('Connection closed') })
  queue.enqueue(async () => { next() })
  await new Promise(r => setTimeout(r, 5))
  expect(failed).toHaveBeenCalledOnce(); expect(next).toHaveBeenCalledOnce()
})
it('acknowledges only after presentation and preserves arrival order', async () => {
  const order: string[] = [], queue = new CombatSequencer(() => {}, () => {})
  let release!: () => void
  queue.enqueue(async () => { order.push('cast'); await new Promise<void>(r => { release = r }) }, () => order.push('ack-cast'))
  queue.enqueue(async () => { order.push('turn-ready') }, () => order.push('ack-turn'))
  await Promise.resolve(); expect(order).toEqual(['cast'])
  release(); await new Promise(r => setTimeout(r, 5))
  expect(order).toEqual(['cast', 'ack-cast', 'turn-ready', 'ack-turn'])
})
it('a context reset cancels pending presentations and old acknowledgements', async () => {
  const ack = vi.fn(), next = vi.fn(), queue = new CombatSequencer(() => {}, () => {})
  queue.enqueue(async signal => { await new Promise<void>(r => signal.addEventListener('abort', () => r())) }, ack)
  queue.enqueue(async () => { next() }, ack)
  await Promise.resolve(); queue.reset(); await new Promise(r => setTimeout(r, 5))
  expect(ack).not.toHaveBeenCalled(); expect(next).not.toHaveBeenCalled()
})
it('a missing visual times out, aborts its task, and releases synchronization', async () => {
  vi.useFakeTimers(); const ack = vi.fn(), busy = vi.fn(), queue = new CombatSequencer(busy, () => {})
  let signal: AbortSignal | undefined
  queue.enqueue(async s => { signal = s; await new Promise(() => {}) }, ack)
  await vi.advanceTimersByTimeAsync(4600)
  expect(signal?.aborted).toBe(true); expect(ack).toHaveBeenCalledTimes(1); expect(busy).toHaveBeenLastCalledWith(false)
})
it('a barrier settles only after prior steps, in arrival order', async () => {
  const order: string[] = [], queue = new CombatSequencer(() => {}, () => {})
  queue.enqueue(async () => { order.push('tackle') })
  queue.barrier(() => order.push('checkpoint'))
  await queue.drain()
  expect(order).toEqual(['tackle', 'checkpoint'])
})
