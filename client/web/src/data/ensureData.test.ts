import { afterEach, expect, it, vi } from 'vitest'
import { ensureData } from './ensureData'
afterEach(() => vi.unstubAllGlobals())
it.each(['native', 'http'])('keeps the %s extraction slot until completion after cancellation and prioritizes visible work', async transport => {
  let finish!: (value: { ok: boolean }) => void
  let started!: () => void
  const ready = new Promise<void>(resolve => { started = resolve })
  const order: Array<string | number> = []
  const native = vi.fn((_kind: string, value: string | number) => {
    order.push(value)
    if (value === 'first') { started(); return new Promise<{ ok: boolean }>(resolve => { finish = resolve }) }
    return Promise.resolve({ ok: true })
  })
  vi.stubGlobal('window', transport === 'native' ? { ginyNative: { ensureData: native } } : {})
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
    expect(options.signal).toBeUndefined()
    const { kind, value } = JSON.parse(String(options.body))
    return new Response(JSON.stringify(await native(kind, value)))
  }))
  const controller = new AbortController()
  const first = ensureData('look', 'first', controller.signal)
  const cancelled = expect(first).rejects.toMatchObject({ name: 'AbortError' })
  await ready
  const background = ensureData('look', 'background', undefined, { priority: 'background' })
  const visible = ensureData('look', 'visible')
  controller.abort(); await cancelled
  expect(native).toHaveBeenCalledTimes(1)
  finish({ ok: true })
  await Promise.all([background, visible])
  expect(order).toEqual(['first', 'visible', 'background'])
})
