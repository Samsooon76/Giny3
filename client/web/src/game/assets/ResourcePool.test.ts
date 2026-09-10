import { expect, it, vi } from 'vitest'
import { ResourcePool } from './ResourcePool'
import { TaskQueue } from './TaskQueue'
import { DocumentCache } from './DocumentCache'
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}

it('shares a source and never evicts it while another scene owns it', async () => {
  const dispose = vi.fn(async () => undefined)
  const load = vi.fn(async (key: string) => ({ key, bytes: 8 }))
  const pool = new ResourcePool(load, dispose, value => value.bytes, 10)
  const first = await pool.acquire('shared'), second = await pool.acquire('shared')
  const next = await pool.acquire('next')
  first.release(); pool.trim(true)
  expect(dispose).not.toHaveBeenCalled()
  expect(pool.stats.overBudgetBytes).toBe(6)
  second.release()
  expect(dispose).toHaveBeenCalledWith('shared', first.value)
  expect(pool.stats.bytes).toBe(8)
  next.release(); pool.trim(true)
  expect(pool.stats.bytes).toBe(0)
  expect(load).toHaveBeenCalledTimes(2)
})

it('cancelling one consumer does not cancel another consumer of the same load', async () => {
  const source = deferred<{ bytes: number }>()
  const pool = new ResourcePool(() => source.promise, async () => undefined, v => v.bytes)
  const controller = new AbortController()
  const first = pool.acquire('shared', { signal: controller.signal })
  const second = pool.acquire('shared')
  controller.abort()
  await expect(first).rejects.toMatchObject({ name: 'AbortError' })
  source.resolve({ bytes: 8 })
  const lease = await second
  expect(lease.value.bytes).toBe(8)
  expect(pool.stats.pinned).toBe(1)
  lease.release()
})

it('a cancelled load retires before the same URL is acquired again', async () => {
  const old = deferred<{ bytes: number; version: number }>()
  const retired = deferred<void>()
  const load = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue({ bytes: 2, version: 2 })
  const dispose = vi.fn(() => retired.promise)
  const pool = new ResourcePool<{ bytes: number; version: number }>(load, dispose, value => value.bytes)
  const controller = new AbortController()
  const first = pool.acquire('asset', { signal: controller.signal })
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1))
  controller.abort()
  await expect(first).rejects.toMatchObject({ name: 'AbortError' })
  const next = pool.acquire('asset')
  old.resolve({ bytes: 5, version: 1 })
  await vi.waitFor(() => expect(dispose).toHaveBeenCalledTimes(1))
  expect(load).toHaveBeenCalledTimes(1)
  retired.resolve()
  const lease = await next
  expect(lease.value.version).toBe(2)
  expect(pool.stats.bytes).toBe(2)
  lease.release()
})

it('admits active work before queued speculation and removes aborted tasks', async () => {
  const queue = new TaskQueue(1), gate = deferred<void>(), order: string[] = []
  const running = queue.run(() => gate.promise)
  const controller = new AbortController()
  const cancelled = queue.run(async () => { order.push('cancelled') }, { signal: controller.signal })
  const background = queue.run(async () => { order.push('background') }, { priority: 'background' })
  const foreground = queue.run(async () => { order.push('active') })
  controller.abort()
  await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
  gate.resolve()
  await Promise.all([running, foreground, background])
  expect(order).toEqual(['active', 'background'])
})

it('evicts least recently used documents and permits failed requests to retry', async () => {
  const cache = new DocumentCache<number, string>(2, 8, v => v.length)
  await cache.get(1, async () => 'aaa'); await cache.get(2, async () => 'bbb')
  await cache.get(1, async () => 'wrong'); await cache.get(3, async () => 'ccc')
  const reload = vi.fn(async () => 'bbb')
  await cache.get(2, reload)
  expect(reload).toHaveBeenCalledOnce()
  await expect(cache.get(4, async () => { throw new Error('retry') })).rejects.toThrow('retry')
  await expect(cache.get(4, async () => 'd')).resolves.toBe('d')
  expect(cache.stats.entries).toBeLessThanOrEqual(2)
  expect(cache.stats.estimatedBytes).toBeLessThanOrEqual(8)
})

it('evicts idle sources in release order without evicting a reacquired source', async () => {
  const dispose = vi.fn(async (_key: string, _value: { key: string }) => undefined)
  const pool = new ResourcePool(async (key: string) => ({ key }), dispose, () => 10, 100)
  const a = await pool.acquire('a'), b = await pool.acquire('b'), c = await pool.acquire('c')
  a.release(); b.release(); c.release()
  const reused = await pool.acquire('a')
  pool.setBudget(20)
  expect(dispose.mock.calls.map(call => call[0])).toEqual(['b'])
  reused.release()
  pool.setBudget(10)
  expect(dispose.mock.calls.map(call => call[0])).toEqual(['b', 'c'])
  pool.trim(true)
  expect(pool.stats.bytes).toBe(0)
})

it('aborts document fetch only after its last owner leaves, then allows a fresh request', async () => {
  const cache = new DocumentCache<string, string>(2, 100, v => v.length)
  let shared!: AbortSignal
  const load = vi.fn((signal: AbortSignal) => {
    shared = signal
    return new Promise<string>((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)))
  })
  const a = new AbortController(), b = new AbortController()
  const first = cache.get('doc', load, { signal: a.signal })
  const second = cache.get('doc', load, { signal: b.signal })
  a.abort(); await expect(first).rejects.toMatchObject({ name: 'AbortError' })
  expect(shared.aborted).toBe(false)
  b.abort(); await expect(second).rejects.toMatchObject({ name: 'AbortError' })
  expect(shared.aborted).toBe(true)
  await expect(cache.get('doc', async () => 'fresh')).resolves.toBe('fresh')
  expect(load).toHaveBeenCalledOnce()
  expect(cache.stats.estimatedBytes).toBe(5)
})

it('accounts for pinned, idle and asynchronously retiring bytes without reporting early release', async () => {
  const retirement = deferred<void>()
  const pool = new ResourcePool(async () => ({}), () => retirement.promise, () => 10, 100)
  const first = await pool.acquire('first'), second = await pool.acquire('second')
  expect(pool.stats).toMatchObject({ bytes: 20, pinnedBytes: 20, idleBytes: 0, accountedBytes: 20 })
  first.release()
  expect(pool.stats).toMatchObject({ pinnedBytes: 10, idleBytes: 10 })
  pool.trim(true)
  expect(pool.stats).toMatchObject({ bytes: 10, retiringBytes: 10, accountedBytes: 20 })
  retirement.resolve()
  await vi.waitFor(() => expect(pool.stats.retiringBytes).toBe(0))
  expect(pool.stats.accountedBytes).toBe(10)
  second.release(); pool.trim(true)
})

it('rejects admission beyond the hard limit without destroying a pinned source', async () => {
  const dispose = vi.fn(async () => undefined)
  const pool = new ResourcePool(async () => ({}), dispose, () => 10, 100, 2, 15)
  const first = await pool.acquire('first')
  await expect(pool.acquire('second')).rejects.toMatchObject({ name: 'ResourceLimitError' })
  expect(pool.stats).toMatchObject({ bytes: 10, pinnedBytes: 10, rejected: 1 })
  expect(dispose).toHaveBeenCalledOnce()
  first.release()
  const second = await pool.acquire('second')
  expect(pool.stats.bytes).toBe(10)
  second.release(); pool.trim(true)
})

it('keeps admission waiting for retirement inside the bounded loading queue', async () => {
  const retirement = deferred<void>(), loaded: string[] = []
  const pool = new ResourcePool(async key => { loaded.push(key); return {} }, () => retirement.promise, () => 10, 100, 1, 15)
  const first = await pool.acquire('first'); first.release()
  const second = pool.acquire('second')
  await vi.waitFor(() => expect(loaded).toEqual(['first', 'second']))
  const third = pool.acquire('third')
  await Promise.resolve()
  expect(loaded).toEqual(['first', 'second'])
  const denied = expect(third).rejects.toMatchObject({ name: 'ResourceLimitError' })
  retirement.resolve()
  const lease = await second
  await denied
  expect(pool.stats.bytes).toBe(10)
  lease.release(); pool.trim(true)
})
