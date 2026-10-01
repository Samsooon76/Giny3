import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GinyNative } from '../data/ensureData'
import { openGinyTransport } from './transport'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
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

class MockWebSocket extends EventTarget {
  static OPEN = 1
  static sockets: MockWebSocket[] = []
  readyState = 0
  binaryType = ''
  send = vi.fn()
  close = vi.fn(() => { this.readyState = 3; this.dispatchEvent(new Event('close')) })
  constructor(_url: string) { super(); MockWebSocket.sockets.push(this) }
}

function browserTransport() {
  vi.useFakeTimers()
  MockWebSocket.sockets = []
  vi.stubGlobal('window', {})
  vi.stubGlobal('location', { protocol: 'http:', host: 'localhost:5173' })
  vi.stubGlobal('WebSocket', MockWebSocket)
  const opened = openGinyTransport()
  return { opened, socket: MockWebSocket.sockets[0] }
}

describe('browser Giny transport', () => {
  it('rejects a gateway that closes before opening', async () => {
    const { opened, socket } = browserTransport()
    const rejected = expect(opened).rejects.toThrow('Passerelle WebSocket Giny indisponible.')
    socket.dispatchEvent(new Event('close'))
    await rejected
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds the connection deadline and ignores a late open', async () => {
    const { opened, socket } = browserTransport()
    const rejected = expect(opened).rejects.toThrow('Passerelle WebSocket Giny indisponible.')
    await vi.advanceTimersByTimeAsync(5000)
    await rejected
    expect(socket.close).toHaveBeenCalledOnce()
    socket.dispatchEvent(new Event('open'))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the connection deadline and reports a later gateway close', async () => {
    const { opened, socket } = browserTransport()
    socket.readyState = MockWebSocket.OPEN
    socket.dispatchEvent(new Event('open'))
    const transport = await opened
    const closed = vi.fn()
    transport.onClose(closed)
    expect(transport.isOpen()).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(socket.close).not.toHaveBeenCalled()
    transport.close()
    expect(closed).toHaveBeenCalledOnce()
    expect(transport.isOpen()).toBe(false)
  })
})
