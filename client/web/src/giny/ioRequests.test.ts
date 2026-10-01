import { afterEach, expect, it, vi } from 'vitest'
import { GinyClient } from './GinyClient'
import { FrameReplies } from './FrameReplies'
import { Writer } from './binary'
import { MESSAGES } from './messages'
import type { GinyFrame } from './frameCodec'
import * as transports from './transport'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('leaves no orphan reply timeout when sending a HUD request fails', async () => {
  vi.useFakeTimers()
  const client = new GinyClient()
  expect(await client.requestCharacterHud()).toBeNull()
  expect(vi.getTimerCount()).toBe(0)
  client.close()
})

it('shares an in-flight actor snapshot between world loading and actor refresh', async () => {
  vi.useFakeTimers()
  const client = new GinyClient()
  const internal = client as unknown as { send: () => void; replies: FrameReplies; dispatchFrame: (frame: GinyFrame) => void }
  Object.assign(internal, { currentMapId: 101 })
  const send = vi.fn()
  internal.send = send
  const first = client.snapshot(), second = client.snapshot()
  expect(send).toHaveBeenCalledTimes(1)
  internal.dispatchFrame({ messageId: MESSAGES.MODERN_MAP_SNAPSHOT, payload: new Writer().utf(JSON.stringify({ map_id: 101, actors: [], interactives: [] })).finish() })
  expect(await first).toEqual({ actors: [], interactives: [] })
  expect(await second).toEqual({ actors: [], interactives: [] })
  expect(vi.getTimerCount()).toBe(0)
  client.close()
})

it('finishes the old actor request before loading the next map', async () => {
  const client = new GinyClient()
  const internal = client as unknown as { currentMapId: number; send: () => void; dispatchFrame: (frame: GinyFrame) => void }
  internal.currentMapId = 101
  const send = vi.fn()
  internal.send = send
  const first = expect(client.snapshot()).rejects.toThrow('La carte a changé pendant son chargement.')
  internal.currentMapId = 102
  const second = client.snapshot()
  const reply = (id: number) => internal.dispatchFrame({ messageId: MESSAGES.MODERN_MAP_SNAPSHOT,
    payload: new Writer().utf(JSON.stringify({ map_id: id, actors: [], interactives: [] })).finish() })
  expect(send).toHaveBeenCalledTimes(1)
  reply(101)
  await first
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2))
  reply(102)
  expect(await second).toEqual({ actors: [], interactives: [] })
  client.close()
})

it('cancels a failed gateway control send without leaving a timeout', async () => {
  vi.useFakeTimers()
  const client = new GinyClient()
  const internal = client as unknown as { connectTarget: (control: object) => Promise<void> }
  Object.assign(internal, { transport: { send: () => { throw new Error('IPC closed') }, close: vi.fn(), isOpen: () => true } })
  await expect(internal.connectTarget({ type: 'connect-auth' })).rejects.toThrow('IPC closed')
  expect(vi.getTimerCount()).toBe(0)
  client.close()
})

it.each(['auth', 'world'])('reports an unexpected %s disconnect during a target switch immediately', async target => {
  vi.useFakeTimers()
  const client = new GinyClient()
  const internal = client as unknown as { replies: FrameReplies; onTransportMessage: (data: string) => void }
  Object.assign(internal, { target, switchingTarget: true, account: { id: 1 } })
  const disconnected = vi.fn()
  client.onDisconnect(disconnected)
  const reply = expect(internal.replies.read([MESSAGES.HELLO_GAME], 5000)).rejects.toThrow('déconnecté')
  internal.onTransportMessage(JSON.stringify({ type: 'disconnected' }))
  await reply
  expect(disconnected).toHaveBeenCalledOnce()
  expect(client.account).toBeNull()
  expect(vi.getTimerCount()).toBe(0)
})

it('reports a gateway error while waiting for a game reply', async () => {
  const client = new GinyClient()
  const internal = client as unknown as { replies: FrameReplies; onTransportMessage: (data: string) => void }
  const disconnected = vi.fn()
  client.onDisconnect(disconnected)
  const reply = expect(internal.replies.read([MESSAGES.CHARACTERS_LIST], 5000)).rejects.toThrow('TCP reset')
  expect(() => internal.onTransportMessage('{invalid')).not.toThrow()
  internal.onTransportMessage(JSON.stringify({ type: 'error', message: 'TCP reset' }))
  await reply
  expect(disconnected).toHaveBeenCalledWith('TCP reset')
})

it('does not retain gameplay notifications as future protocol replies', () => {
  const client = new GinyClient()
  const internal = client as unknown as { replies: FrameReplies; dispatchFrame: (frame: GinyFrame) => void }
  for (let count = 0; count < 1000; count++) {
    internal.dispatchFrame({ messageId: MESSAGES.OBJECT_MODIFIED, payload: new Uint8Array() })
    internal.dispatchFrame({ messageId: MESSAGES.ROLEPLAY_SHOW_ACTOR, payload: new Uint8Array() })
    internal.dispatchFrame({ messageId: MESSAGES.BASIC_NO_OPERATION, payload: new Uint8Array() })
  }
  expect(internal.replies.queuedCount).toBe(0)
  client.close()
})

it('closes a gateway that finishes opening after logout', async () => {
  const transport = { send: vi.fn(), close: vi.fn(), isOpen: () => true, onMessage: vi.fn(), onClose: vi.fn() }
  let opened!: (value: typeof transport) => void
  vi.spyOn(transports, 'openGinyTransport').mockImplementation(() => new Promise(resolve => { opened = resolve }))
  const client = new GinyClient()
  const login = client.authenticate('admin', 'test')
  const rejected = expect(login).rejects.toThrow('Connexion Giny fermée.')
  client.close()
  opened(transport)
  await rejected
  expect(transport.close).toHaveBeenCalledOnce()
  expect(transport.send).not.toHaveBeenCalled()
})
