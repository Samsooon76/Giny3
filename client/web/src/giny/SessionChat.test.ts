import { expect, it } from 'vitest'
import { SessionChat } from './SessionChat'
import type { ChatLine } from './types'

const line = (id: number, content = String(id)): ChatLine => ({
  id: `chat-${id}`, kind: 'info', channel: 0, content, timestamp: id,
})

it('bounds replay history and never exposes server state payloads to subscribers', () => {
  const chat = new SessionChat()
  for (let i = 0; i < 205; i++) chat.emit(line(i))
  chat.emit(line(205, '<font color="red">[QUEST_STATE]secret'))
  const received: ChatLine[] = []
  const unsubscribe = chat.subscribe(value => received.push(value))
  expect(received).toHaveLength(200)
  expect(received[0].id).toBe('chat-5')
  expect(received.at(-1)?.id).toBe('chat-204')
  unsubscribe()
  chat.emit(line(206))
  expect(received).toHaveLength(200)
})

it('clears the previous session history and IDs while preserving live subscriptions', () => {
  const chat = new SessionChat()
  chat.emit(line(1))
  expect(chat.nextId()).toBe('chat-1')
  const received: ChatLine[] = []
  chat.subscribe(value => received.push(value), false)
  chat.reset()
  const replay: ChatLine[] = []
  chat.subscribe(value => replay.push(value))
  expect(replay).toEqual([])
  expect(chat.nextId()).toBe('chat-1')
  chat.emit(line(2))
  expect(received).toEqual([line(2)])
  expect(replay).toEqual([line(2)])
})
