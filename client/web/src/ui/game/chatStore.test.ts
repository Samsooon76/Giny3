import { afterEach, describe, expect, it } from 'vitest'
import { chatChannelShortcut, chatStore, nextChatLineId, splitChatPrefix } from './chatStore'

afterEach(() => {
  chatStore.clear()
})

describe('chat store', () => {
  it('appends lines and clears the draft on demand', () => {
    chatStore.setDraft('salut')
    expect(chatStore.snapshot().draft).toBe('salut')
    chatStore.append({
      id: nextChatLineId(),
      kind: 'message',
      channel: 0,
      sender: 'Hugo',
      content: 'salut',
      timestamp: 1,
    })
    expect(chatStore.snapshot().lines).toHaveLength(1)
    expect(chatStore.snapshot().lines[0]?.content).toBe('salut')
    chatStore.setDraft('')
    expect(chatStore.snapshot().draft).toBe('')
  })

  it('ignores a duplicate id so a replayed buffer does not double a row', () => {
    const line = { id: 'chat-1', kind: 'info' as const, channel: 10, content: 'ok', timestamp: 1 }
    chatStore.append(line)
    chatStore.append(line)
    expect(chatStore.snapshot().lines).toHaveLength(1)
  })

  it('drops hidden server sync payloads instead of painting them', () => {
    chatStore.append({
      id: nextChatLineId(), kind: 'info', channel: 10,
      content: '[QUEST_STATE]%7B%22operation%22%3A%22SYNC%22%7D', timestamp: 1,
    })
    chatStore.append({
      id: nextChatLineId(), kind: 'info', channel: 10,
      content: '[POKEFUS_STATE]%7B%7D', timestamp: 1,
    })
    expect(chatStore.snapshot().lines).toHaveLength(0)
  })

  it('cycles official channels and parses /prefixes like the client', () => {
    expect(chatChannelShortcut(0)).toBe('/s')
    expect(chatStore.snapshot().channel).toBe(0)
    chatStore.cycleChannel()
    expect(chatStore.snapshot().channel).toBe(1)
    expect(splitChatPrefix('/g salut', 0)).toEqual({ channel: 2, content: 'salut' })
    expect(splitChatPrefix('salut', 2)).toEqual({ channel: 2, content: 'salut' })
    chatStore.setDraft('x'.repeat(300))
    expect(chatStore.snapshot().draft).toHaveLength(256)
  })
})

it('ignores only the selected sender until the session is reset', () => {
  const line = { id: 'first', kind: 'message' as const, channel: 0, senderId: 42, content: 'Salut', timestamp: 1 }
  chatStore.append(line)
  chatStore.setIgnored(42, true)
  expect(chatStore.snapshot().lines).toHaveLength(0)
  chatStore.append({ ...line, id: 'second' })
  chatStore.append({ ...line, id: 'other', senderId: 43 })
  expect(chatStore.snapshot().lines.map(row => row.senderId)).toEqual([43])
  chatStore.clear()
  chatStore.append(line)
  expect(chatStore.isIgnored(42)).toBe(false)
  expect(chatStore.snapshot().lines).toHaveLength(1)
})
