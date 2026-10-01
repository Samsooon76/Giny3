import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GinyNative } from '../data/ensureData'
import { Writer } from './binary'
import { GinyClient } from './GinyClient'
import { MESSAGES } from './messages'
import { decryptTicket } from './parsers'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function mockNative() {
  const controls: Array<(text: string) => void> = []
  const datas: Array<(bytes: Uint8Array) => void> = []
  const native: GinyNative = {
    ensureData: async () => ({ ok: true }),
    connect: vi.fn(),
    sendFrame: vi.fn(),
    close: vi.fn(),
    onControl: (callback) => {
      controls.push(callback)
      return () => {
        const index = controls.indexOf(callback)
        if (index >= 0) controls.splice(index, 1)
      }
    },
    onData: (callback) => {
      datas.push(callback)
      return () => {
        const index = datas.indexOf(callback)
        if (index >= 0) datas.splice(index, 1)
      }
    },
  }
  return {
    native,
    emitControl: (payload: object) => {
      const text = JSON.stringify(payload)
      ;[...controls].forEach((emit) => emit(text))
    },
    emitData: (bytes: Uint8Array) => {
      ;[...datas].forEach((emit) => emit(bytes))
    },
  }
}

function packServerFrame(messageId: number, payload: Uint8Array): Uint8Array {
  const size = payload.length
  const lengthType = size > 65535 ? 3 : size > 255 ? 2 : size > 0 ? 1 : 0
  const result = new Uint8Array(2 + lengthType + size)
  const view = new DataView(result.buffer)
  view.setUint16(0, (messageId << 2) | lengthType, false)
  let offset = 2
  if (lengthType === 1) result[offset++] = size
  else if (lengthType === 2) {
    view.setUint16(offset, size, false)
    offset += 2
  } else if (lengthType === 3) {
    result[offset++] = (size >>> 16) & 0xff
    view.setUint16(offset, size & 0xffff, false)
    offset += 2
  }
  result.set(payload, offset)
  return result
}

function lastConnectType(native: GinyNative): string | undefined {
  const raw = (native.connect as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]
  if (typeof raw !== 'string') return undefined
  try {
    return (JSON.parse(raw) as { type?: string }).type
  } catch {
    return undefined
  }
}

function lastFrameId(native: GinyNative): number | undefined {
  const frame = (native.sendFrame as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as Uint8Array | undefined
  return frame && ((frame[0] << 8) | frame[1]) >>> 2
}

async function encryptTicket(ticket: string, key: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', new Uint8Array(key), { name: 'AES-CBC' }, false, ['encrypt'])
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: new Uint8Array(key.subarray(0, 16)) },
    cryptoKey,
    new TextEncoder().encode(ticket),
  )
  return new Uint8Array(encrypted)
}

describe('GinyClient onDisconnect', () => {
  it('triggers onDisconnect when the server unexpectedly drops the connection', async () => {
    const { native, emitControl } = mockNative()
    vi.stubGlobal('window', { ginyNative: native })
    const client = new GinyClient()
    const disconnected = vi.fn()
    client.onDisconnect(disconnected)

    const authPromise = client.authenticate('admin', 'test')
    await Promise.resolve()
    await Promise.resolve()
    emitControl({ type: 'connected' })
    await Promise.resolve()
    emitControl({ type: 'disconnected' })

    expect(disconnected).toHaveBeenCalledWith('La connexion avec le serveur a été perdue.')
    await expect(authPromise).rejects.toThrow()
    client.close()
  })

  it('does not trigger onDisconnect on manual client close', async () => {
    const { native } = mockNative()
    vi.stubGlobal('window', { ginyNative: native })
    const client = new GinyClient()
    const disconnected = vi.fn()
    client.onDisconnect(disconnected)

    client.close()
    expect(disconnected).not.toHaveBeenCalled()
  })

  it('keeps the gateway through Auth hangup so World can take the ticket', async () => {
    const { native, emitControl, emitData } = mockNative()
    vi.stubGlobal('window', { ginyNative: native })
    const aesKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1)
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(<T extends ArrayBufferView>(array: T) => {
      if (array instanceof Uint8Array) array.set(aesKey.subarray(0, array.length))
      return array
    })
    const ticket = 'world-ticket'
    const encryptedTicket = await encryptTicket(ticket, aesKey)
    expect(await decryptTicket(encryptedTicket, aesKey)).toBe(ticket)

    const client = new GinyClient()
    // Same contract as App.tsx: an unexpected disconnect logs the player out
    // and closes the gateway. Auth's hangup after SelectedServerData must not
    // take that path or connect-world throws "Passerelle Giny fermée."
    client.onDisconnect(() => client.close())

    const login = client.authenticate('admin', 'test')
    await vi.waitFor(() => expect(lastConnectType(native)).toBe('connect-auth'))
    emitControl({ type: 'connected' })
    emitData(packServerFrame(MESSAGES.HELLO_CONNECT, new Uint8Array()))
    await vi.waitFor(() => expect(lastFrameId(native)).toBe(MESSAGES.IDENTIFICATION))
    emitData(packServerFrame(
      MESSAGES.IDENTIFICATION_SUCCESS,
      new Writer().u8(0).utf('admin').utf('Hugo').utf('#0001').i32(1).finish(),
    ))
    emitData(packServerFrame(
      MESSAGES.SERVERS_LIST,
      new Writer().u16(1).u8(2).varUInt(50).u8(0).u8(3).u8(0).u8(1).u8(5).f64(0).finish(),
    ))
    await login
    const servers = await client.listServers()
    expect(servers[0]?.id).toBe(50)

    const selected = client.selectServer(50)
    await vi.waitFor(() => expect(lastFrameId(native)).toBe(MESSAGES.SERVER_SELECTION))
    emitData(packServerFrame(
      MESSAGES.SELECTED_SERVER_DATA,
      new Writer()
        .varUInt(50)
        .utf('127.0.0.1')
        .u16(1)
        .varUInt(5555)
        .u8(1)
        .varUInt(encryptedTicket.length)
        .raw(encryptedTicket)
        .finish(),
    ))
    // Auth closes immediately after SelectedServerData — delivered in the same
    // turn as the frame, before selectServer continues past readUntil.
    emitControl({ type: 'disconnected' })
    await vi.waitFor(() => expect(lastConnectType(native)).toBe('connect-world'))
    emitControl({ type: 'connected' })
    emitData(packServerFrame(MESSAGES.HELLO_GAME, new Uint8Array()))
    await vi.waitFor(() => expect(lastFrameId(native)).toBe(MESSAGES.AUTHENTICATION_TICKET))
    emitData(packServerFrame(MESSAGES.AUTHENTICATION_TICKET_ACCEPTED, new Uint8Array()))
    await expect(selected).resolves.toMatchObject({ id: 50, host: '127.0.0.1', ports: [5555] })
    client.close()
  })
})
