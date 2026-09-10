import { afterEach, expect, it, vi } from 'vitest'
import { GinyClient } from './GinyClient'
import { FrameReplies } from './FrameReplies'
import { Writer } from './binary'
import { MESSAGES } from './messages'
import type { GinyFrame } from './frameCodec'

afterEach(() => vi.useRealTimers())
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
