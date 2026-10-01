import type { GinyFrame } from './frameCodec'

type Waiter = {
  ids: Set<number>
  resolve: (frame: GinyFrame) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

/** Owns buffered replies and their deadlines; game notifications stay in GinyClient. */
export class FrameReplies {
  private frames: GinyFrame[] = []
  private waiters: Waiter[] = []

  get queuedCount(): number { return this.frames.length }

  discard(messageId?: number): void {
    this.frames = messageId === undefined ? [] : this.frames.filter(frame => frame.messageId !== messageId)
  }

  queue(frame: GinyFrame): void { this.frames.push(frame) }

  /** Remove the first matching waiter before the caller publishes related state. */
  take(messageId: number): ((frame: GinyFrame) => void) | undefined {
    const index = this.waiters.findIndex(waiter => waiter.ids.has(messageId))
    if (index < 0) return undefined
    const waiter = this.waiters.splice(index, 1)[0]
    clearTimeout(waiter.timeout)
    return waiter.resolve
  }

  read(ids: number[], timeoutMs: number): Promise<GinyFrame> {
    const index = this.frames.findIndex(frame => ids.includes(frame.messageId))
    if (index >= 0) return Promise.resolve(this.frames.splice(index, 1)[0])
    return this.wait(ids, timeoutMs)
  }

  /** Install the reply waiter before sending, and cancel it if send throws. */
  request(ids: number[], timeoutMs: number, send: () => void): Promise<GinyFrame> {
    for (const id of ids) this.discard(id)
    return this.wait(ids, timeoutMs, send)
  }

  private wait(ids: number[], timeoutMs: number, send?: () => void): Promise<GinyFrame> {
    return new Promise((resolve, reject) => {
      const waiter: Waiter = { ids: new Set(ids), resolve, reject,
        timeout: setTimeout(() => {
          const index = this.waiters.indexOf(waiter)
          if (index >= 0) this.waiters.splice(index, 1)
          reject(new Error(`Timeout Giny (${ids.join(', ')}).`))
        }, timeoutMs),
      }
      this.waiters.push(waiter)
      try { send?.() } catch (error) {
        const index = this.waiters.indexOf(waiter)
        if (index >= 0) this.waiters.splice(index, 1)
        clearTimeout(waiter.timeout)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  fail(error: Error, messageId?: number): void {
    const rejected = this.waiters.filter(waiter => messageId === undefined || waiter.ids.has(messageId))
    this.waiters = this.waiters.filter(waiter => !rejected.includes(waiter))
    for (const waiter of rejected) {
      clearTimeout(waiter.timeout)
      waiter.reject(error)
    }
  }
}
