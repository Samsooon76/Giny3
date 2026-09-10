import { afterEach, expect, it, vi } from 'vitest'
import { GinyClient } from './GinyClient'
import { MESSAGES } from './messages'
import type { GinyFrame } from './frameCodec'
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
it('uses a ten-second fallback, reacts to notifications, and suspends hidden polling', async () => {
  vi.useFakeTimers()
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  const window = Object.assign(new EventTarget(), { setInterval, clearInterval })
  vi.stubGlobal('document', document); vi.stubGlobal('window', window)
  const client = new GinyClient()
  const internal = client as unknown as { characterLoaded: boolean; dispatchFrame(frame: GinyFrame): void }
  internal.characterLoaded = true
  const refresh = vi.spyOn(client, 'requestCharacterHud').mockResolvedValue(null)
  const changed = vi.fn(), unsubscribe = client.onActorsChanged(changed)
  const stop = client.startHudSynchronization()
  try {
    expect(refresh).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(9900)
    expect(refresh).toHaveBeenCalledTimes(1)
    internal.dispatchFrame({ messageId: MESSAGES.OBJECT_MODIFIED, payload: new Uint8Array() })
    internal.dispatchFrame({ messageId: MESSAGES.OBJECT_QUANTITY, payload: new Uint8Array() })
    await vi.advanceTimersByTimeAsync(100)
    expect(refresh).toHaveBeenCalledTimes(3) // One periodic reconciliation plus one notification burst.
    internal.dispatchFrame({ messageId: MESSAGES.ROLEPLAY_SHOW_ACTOR, payload: new Uint8Array() })
    expect(changed).toHaveBeenCalledTimes(1)
    document.visibilityState = 'hidden'
    await vi.advanceTimersByTimeAsync(10000)
    expect(refresh).toHaveBeenCalledTimes(3)
    document.visibilityState = 'visible'; document.dispatchEvent(new Event('visibilitychange'))
    expect(refresh).toHaveBeenCalledTimes(4)
  } finally { stop(); unsubscribe(); client.close() }
})
