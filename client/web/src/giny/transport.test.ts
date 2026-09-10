import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GinyNative } from '../data/ensureData'
import { openGinyTransport } from './transport'

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockNative() {
  const controls: Array<(text: string) => void> = []
  const stopControl = vi.fn(() => {
    controls.length = 0
  })
  const stopData = vi.fn()
  const native: GinyNative = {
    ensureData: async () => ({ ok: true }),
    connect: vi.fn(),
    sendFrame: vi.fn(),
    close: vi.fn(),
    onControl: (callback) => {
      controls.push(callback)
      return stopControl
    },
    onData: () => stopData,
  }
  return {
    native,
    stopControl,
    stopData,
    emitControl: (payload: object) => {
      const text = JSON.stringify(payload)
      controls.forEach((emit) => emit(text))
    },
  }
}

describe('native Giny transport', () => {
  it('keeps the gateway open when Auth hangs up before World', async () => {
    const { native, emitControl } = mockNative()
    vi.stubGlobal('window', { ginyNative: native })
    const closed = vi.fn()
    const transport = await openGinyTransport()
    transport.onClose(closed)
    emitControl({ type: 'disconnected' })
    expect(transport.isOpen()).toBe(true)
    expect(closed).not.toHaveBeenCalled()
    transport.send(Uint8Array.from([1, 2, 3]))
    expect(native.sendFrame).toHaveBeenCalled()
  })

  it('drops IPC listeners when the gateway is closed', async () => {
    const { native, stopControl, stopData } = mockNative()
    vi.stubGlobal('window', { ginyNative: native })
    const transport = await openGinyTransport()
    transport.close()
    expect(stopControl).toHaveBeenCalled()
    expect(stopData).toHaveBeenCalled()
    expect(native.close).toHaveBeenCalled()
  })
})
