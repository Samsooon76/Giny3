import { expect, it } from 'vitest'
import { privateChatPayload } from './privateChat'
import { Reader } from './binary'
it('serializes the private message and named receiver in Giny protocol order', () => {
  const reader = new Reader(privateChatPayload('/w Im-Emotional Bonjour à toi !')!)
  expect(reader.utf()).toBe('Bonjour à toi !')
  expect(reader.u16()).toBe(3022)
  expect(reader.utf()).toBe('Im-Emotional')
  expect(reader.offset).toBe(reader.bytes.length)
})
it('never falls back to the public channel for an incomplete private command', () => {
  expect(() => privateChatPayload('/w')).toThrow()
  expect(() => privateChatPayload('/w Im-Emotional ')).toThrow()
  expect(privateChatPayload('Bonjour')).toBeUndefined()
})
