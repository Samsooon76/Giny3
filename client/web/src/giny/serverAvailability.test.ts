import { expect, it, vi } from 'vitest'
import { Writer } from './binary'
import { GinyClient } from './GinyClient'
import type { GinyFrame } from './frameCodec'
import { MESSAGES } from './messages'
import { parseServers, parseServerSelectionRefused } from './parsers'

function server(status: number, selectable = true) {
  return new Writer().u8(selectable ? 2 : 0).varUInt(50).u8(0).u8(status).u8(0).u8(1).u8(5).f64(0).finish()
}
function listing(status: number, selectable = true) {
  return new Writer().u16(1).raw(server(status, selectable)).finish()
}
function receive(client: GinyClient, messageId: number, payload: Uint8Array) {
  ;(client as unknown as { dispatchFrame(frame: GinyFrame): void }).dispatchFrame({ messageId, payload })
}
it('never treats Auth’s always-true selectable flag as proof that World is online', () => {
  for (const status of [0, 1, 2, 4, 5, 6, 7]) expect(parseServers(listing(status))[0].selectable).toBe(false)
  expect(parseServers(listing(3))[0].selectable).toBe(true)
  expect(parseServers(listing(3, false))[0].selectable).toBe(false)
})
it('updates the live server list when World registers after the login screen', async () => {
  const client = new GinyClient(), changed = vi.fn()
  client.onServers(changed)
  const initial = client.listServers()
  receive(client, MESSAGES.SERVERS_LIST, listing(1))
  expect((await initial)[0].selectable).toBe(false)
  await expect(client.selectServer(50)).rejects.toThrow('World est hors ligne')
  receive(client, MESSAGES.SERVER_STATUS_UPDATE, server(3))
  expect(changed.mock.calls.at(-1)?.[0][0]).toMatchObject({ id: 50, status: 'Online', selectable: true })
  expect((await client.listServers())[0].selectable).toBe(true)
  receive(client, MESSAGES.SERVERS_LIST, listing(3))
  expect((client as unknown as { replies: { queuedCount: number } }).replies.queuedCount).toBe(0)
  client.close()
})
it('uses the latest push if the initial list arrived before listServers was called', async () => {
  const client = new GinyClient()
  receive(client, MESSAGES.SERVERS_LIST, listing(1))
  receive(client, MESSAGES.SERVERS_LIST, listing(2))
  receive(client, MESSAGES.SERVER_STATUS_UPDATE, server(3))
  expect((await client.listServers())[0].status).toBe('Online')
  client.close()
})
it('reports the wire reason rather than treating monocompte refusals as a crash', () => {
  const offline = parseServerSelectionRefused(new Writer().varUInt(50).u8(0).u8(1).finish())
  expect(offline).toMatchObject({ serverId: 50, reason: 0, status: 'Offline' })
  expect(offline.message).toContain('démarrage')
  expect(parseServerSelectionRefused(new Writer().varUInt(50).u8(6).u8(7).finish()).message).toContain('monocompte')
  expect(parseServerSelectionRefused(new Writer().varUInt(50).u8(99).u8(3).finish()).message).toContain('code 99')
})

it('keeps account portraits through online/offline updates and clears them at logout', async () => {
  const client = new GinyClient()
  const characters = [{ id: 12, name: 'Hugo', look: '{1|10}' }]
  receive(client, MESSAGES.MODERN_SERVER_CHARACTERS, new Writer().utf(JSON.stringify({ servers: [{ id: 50, characters }] })).finish())
  receive(client, MESSAGES.SERVERS_LIST, listing(3))
  expect((await client.listServers())[0].characters).toEqual(characters)
  receive(client, MESSAGES.SERVER_STATUS_UPDATE, server(1))
  expect((await client.listServers())[0]).toMatchObject({ status: 'Offline', characters })
  client.close()
  receive(client, MESSAGES.SERVERS_LIST, listing(3))
  expect((await client.listServers())[0].characters).toEqual([])
  client.close()
})
