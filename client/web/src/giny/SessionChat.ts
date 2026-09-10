import { logEvent } from '../debug/sessionLogger'
import type { GinyFrame } from './frameCodec'
import { MESSAGES } from './messages'
import { isHiddenChatLine, parseChatError, parseChatServerMessage, parseTextInformation } from './parsers'
import type { ChatLine } from './types'

/** Session chat history, decoding and subscriptions, independent of transport. */
export class SessionChat {
  private chatListeners = new Set<(line: ChatLine) => void>()
  private chatBuffer: ChatLine[] = []
  private chatSeq = 0

  reset(): void {
    this.chatBuffer = []
    this.chatSeq = 0
  }

  subscribe(listener: (line: ChatLine) => void, replayHistory = true): () => void {
    if (replayHistory) this.chatBuffer.forEach((line) => listener(line))
    this.chatListeners.add(listener)
    return () => { this.chatListeners.delete(listener) }
  }

  nextId(): string {
    this.chatSeq += 1
    return `chat-${this.chatSeq}`
  }

  parse(frame: GinyFrame): ChatLine | null {
    try {
      if (frame.messageId === MESSAGES.CHAT_SERVER) {
        const line = parseChatServerMessage(frame.payload, this.nextId())
        return isHiddenChatLine(line.content) ? null : line
      }
      if (frame.messageId === MESSAGES.TEXT_INFORMATION) return parseTextInformation(frame.payload, this.nextId())
      if (frame.messageId === MESSAGES.CHAT_ERROR) return parseChatError(frame.payload, this.nextId())
    } catch (error) {
      logEvent('error', 'chat-frame', error instanceof Error ? error.message : String(error))
      return null
    }
    return null
  }

  emit(line: ChatLine): void {
    if (isHiddenChatLine(line.content)) return
    this.chatBuffer.push(line)
    if (this.chatBuffer.length > 200) this.chatBuffer = this.chatBuffer.slice(-200)
    this.chatListeners.forEach((listener) => listener(line))
  }

}
