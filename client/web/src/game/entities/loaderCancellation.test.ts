import { afterEach, expect, it, vi } from 'vitest'
vi.mock('./clipLoader', () => ({ entityPublication: vi.fn(async () => 0), preparedEntity: vi.fn(async () => null) }))
vi.mock('../../data/ensureData', () => ({ ensureData: vi.fn() }))
import { ensureData } from '../../data/ensureData'
import { loadEntityLook } from './loader'
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })
it('aborts legacy look I/O only after its last consumer leaves, without starting extraction', async () => {
  let ioSignal: AbortSignal | undefined
  let notifyStarted!: () => void
  const started = new Promise<void>(resolve => { notifyStarted = resolve })
  vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
    ioSignal = options.signal as AbortSignal
    ioSignal.addEventListener('abort', () => reject(ioSignal?.reason), { once: true })
    notifyStarted()
  })))
  const first = new AbortController(), last = new AbortController()
  const a = loadEntityLook('{1|10}', { signal: first.signal })
  const b = loadEntityLook('{1|10}', { signal: last.signal })
  const rejectedA = expect(a).rejects.toMatchObject({ name: 'AbortError' })
  const rejectedB = expect(b).rejects.toMatchObject({ name: 'AbortError' })
  await started
  first.abort(); await rejectedA
  expect(ioSignal?.aborted).toBe(false)
  last.abort(); await rejectedB
  await Promise.resolve(); await Promise.resolve()
  expect(ioSignal?.aborted).toBe(true)
  expect(ensureData).not.toHaveBeenCalled()
})
