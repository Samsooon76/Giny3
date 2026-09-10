import { describe, expect, it, vi } from 'vitest'
import { GinyClient } from './GinyClient'
import { Writer } from './binary'
import { MESSAGES } from './messages'
import { parseNpcModuleState, type NpcState } from './npcState'
const state: NpcState = { sessionId: 'session', revision: 1, mapId: 100, actorId: -2, templateId: 1, name: 'PNJ', kind: 'talk', messageId: 10, replies: [20], dialogParams: ['Alice'], kamas: 50, currencyBalance: 50, tokenId: 0, offers: null, inventory: [], local: null, remote: null, acceptedGids: [] }
const envelope = (s: unknown, revision = 1, characterId = '42') => JSON.stringify({ schemaVersion: 1, module: 'npc', characterId, revision, state: s })
describe('PNJ state', () => {
  it('retains contextual ids, authorized replies and explicit closing snapshots', () => {
    expect(parseNpcModuleState(envelope(state))?.state).toEqual(state)
    expect(parseNpcModuleState(envelope(null, 2))?.state).toBeNull()
  })
  it('rejects malformed offers, missing collections and inconsistent revisions', () => {
    for (const patch of [{ revision: 2 }, { replies: [-1] }, { inventory: null }, { kind: 'shop', offers: [{ gid: 1, name: 'item', price: -1 }] }, { kind: 'trade' }, { currencyBalance: '50' }])
      expect(parseNpcModuleState(envelope({ ...state, ...patch }))).toBeNull()
    expect(parseNpcModuleState('{')).toBeNull()
  })
  it('isolates characters, ignores old revisions and clears on map transition/disconnect', () => {
    const client = new GinyClient()
    const internal = client as unknown as { selectedCharacter: { id: number }; currentMapId: number; dispatchFrame: (f: { messageId: number; payload: Uint8Array }) => void; emitDisconnect: (reason: string) => void }
    internal.selectedCharacter = { id: 42 }; internal.currentMapId = 100
    const listener = vi.fn(); client.onNpcState(listener)
    const send = (s: unknown, revision: number, id = '42') => internal.dispatchFrame({ messageId: MESSAGES.MODERN_MODULE_STATE, payload: new Writer().utf(envelope(s, revision, id)).finish() })
    send(state, 1, '99'); expect(client.getNpcState()).toBeNull()
    send(state, 1); expect(client.getNpcState()?.name).toBe('PNJ')
    send(null, 2); send(state, 1); expect(client.getNpcState()).toBeNull()
    send({ ...state, revision: 3 }, 3)
    internal.dispatchFrame({ messageId: MESSAGES.CURRENT_MAP, payload: new Writer().f64(101).finish() })
    expect(client.getNpcState()).toBeNull()
    send({ ...state, revision: 4 }, 4); internal.emitDisconnect('test')
    expect(client.getNpcState()).toBeNull(); expect(listener).toHaveBeenCalled()
  })
})
