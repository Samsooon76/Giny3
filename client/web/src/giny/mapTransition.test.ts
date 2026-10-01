import { afterEach, expect, it, vi } from 'vitest'
import { GinyClient } from './GinyClient'
import { FrameReplies } from './FrameReplies'
import { Writer } from './binary'
import { MESSAGES } from './messages'
import type { GinyFrame } from './frameCodec'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('accepts a map reply received during send instead of treating it as an unsolicited teleport', async () => {
  vi.useFakeTimers()
  const client = new GinyClient()
  const internal = client as unknown as {
    send: (id: number, payload: Uint8Array) => void
    dispatchFrame: (frame: GinyFrame) => void
    loadWorldSession: () => Promise<object>
  }
  Object.assign(internal, { account: {}, selectedInternal: {}, selectedCharacter: {}, characterLoaded: true, currentMapId: 100 })
  internal.loadWorldSession = vi.fn().mockResolvedValue({ mapId: 101 })
  internal.send = () => internal.dispatchFrame({ messageId: MESSAGES.CURRENT_MAP, payload: new Writer().f64(101).finish() })
  const changed = vi.fn()
  client.onMapChanged(changed)
  const result = client.changeMap(101)
  await vi.advanceTimersByTimeAsync(0)
  expect(vi.getTimerCount()).toBe(0)
  expect(await result).toEqual({ mapId: 101 })
  expect(changed).not.toHaveBeenCalled()
  client.close()
})

it('publishes only the latest server map after overlapping teleports', async () => {
  const client = new GinyClient()
  const internal = client as unknown as {
    dispatchFrame: (frame: GinyFrame) => void
    loadWorldSession: () => Promise<object>
    serverMapChange: Promise<void> | null
  }
  Object.assign(internal, { characterLoaded: true, currentMapId: 100 })
  let finishFirst!: (session: object) => void
  internal.loadWorldSession = vi.fn()
    .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve }))
    .mockResolvedValue({ mapId: 102 })
  const changed = vi.fn()
  client.onMapChanged(changed)
  const teleport = (id: number) => internal.dispatchFrame({ messageId: MESSAGES.CURRENT_MAP, payload: new Writer().f64(id).finish() })
  teleport(101)
  await vi.waitFor(() => expect(internal.loadWorldSession).toHaveBeenCalledTimes(1))
  teleport(102)
  finishFirst({ mapId: 101 })
  await internal.serverMapChange
  expect(changed.mock.calls).toEqual([[{ mapId: 102 }]])
  client.close()
})

it('does not publish a map load that finishes after logout', async () => {
  const client = new GinyClient()
  const internal = client as unknown as {
    dispatchFrame: (frame: GinyFrame) => void
    loadWorldSession: () => Promise<object>
    serverMapChange: Promise<void> | null
  }
  Object.assign(internal, { characterLoaded: true, currentMapId: 100 })
  let finish!: (session: object) => void
  internal.loadWorldSession = () => new Promise(resolve => { finish = resolve })
  const changed = vi.fn()
  client.onMapChanged(changed)
  internal.dispatchFrame({ messageId: MESSAGES.CURRENT_MAP, payload: new Writer().f64(101).finish() })
  const loading = internal.serverMapChange
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  client.close()
  finish({ mapId: 101 })
  await loading
  expect(changed).not.toHaveBeenCalled()
})
it.each(['Unknown map transition.', 'Unknown map.', "Aucune cellule d'arrivée praticable sur cette carte."])(
  'releases a refused transition immediately and permits retry: %s', async reason => {
    vi.useFakeTimers()
    const client = new GinyClient()
    const internal = client as unknown as {
      send: (id: number, payload: Uint8Array) => void
      dispatchFrame: (frame: GinyFrame) => void
      loadWorldSession: () => Promise<object>
      replies: FrameReplies
    }
    Object.assign(internal, { account: {}, selectedInternal: {}, selectedCharacter: {}, currentMapId: 191105026 })
    internal.send = vi.fn()
    internal.loadWorldSession = vi.fn().mockResolvedValue({ mapId: 191104002 })
    const rejected = expect(client.changeMap(191104002)).rejects.toThrow(`Changement de carte refusé : ${reason}`)
    const unrelated = internal.replies.read([MESSAGES.MODERN_MAP_SNAPSHOT], 2500)
    internal.dispatchFrame({ messageId: MESSAGES.BASIC_NO_OPERATION, payload: new Uint8Array() })
    internal.dispatchFrame({ messageId: MESSAGES.TEXT_INFORMATION,
      payload: new Writer().u8(0).varUInt(0).u16(1).utf(`<font color="#FF8B0000">${reason}</font>`).finish() })
    await rejected
    const snapshot = { messageId: MESSAGES.MODERN_MAP_SNAPSHOT, payload: new Uint8Array() }
    internal.replies.take(snapshot.messageId)?.(snapshot)
    expect(await unrelated).toBe(snapshot)
    expect(vi.getTimerCount()).toBe(0)
    const retry = client.changeMap(191104002)
    internal.dispatchFrame({ messageId: MESSAGES.CURRENT_MAP, payload: new Writer().f64(191104002).finish() })
    expect(await retry).toEqual({ mapId: 191104002 })
    expect(vi.getTimerCount()).toBe(0)
  },
)
