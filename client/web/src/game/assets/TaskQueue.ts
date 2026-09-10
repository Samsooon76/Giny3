export type LoadOptions = { signal?: AbortSignal; priority?: 'active' | 'background'; key?: string; onPromote?: (listener: () => void) => () => void }
export const abortError = () => new DOMException('Chargement annulé', 'AbortError')
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? abortError()
}

/** Limit concurrent work; visible assets always precede queued speculation. */
export class TaskQueue {
  private running = 0
  private waiting: Array<{ priority: number; key?: string; start: () => void }> = []
  private readonly limit: number
  private readonly maxBacklog: number
  constructor(limit: number, maxBacklog = 4096) { this.limit = Math.max(1, limit); this.maxBacklog = maxBacklog }
  run<T>(work: () => Promise<T>, options: LoadOptions = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      let stopPromotion: (() => void) | undefined
      const abort = () => {
        stopPromotion?.()
        const index = this.waiting.indexOf(task)
        if (index >= 0) this.waiting.splice(index, 1)
        reject(options.signal?.reason ?? abortError())
      }
      const task = { key: options.key, priority: options.priority === 'background' ? 1 : 0, start: () => {
        stopPromotion?.()
        options.signal?.removeEventListener('abort', abort)
        if (options.signal?.aborted) { abort(); return }
        this.running++
        Promise.resolve().then(work).then(resolve, reject).finally(() => { this.running--; this.drain() })
      } }
      if (options.signal?.aborted) { abort(); return }
      if (this.waiting.length >= this.maxBacklog) { reject(new Error('File de chargement saturée')); return }
      options.signal?.addEventListener('abort', abort, { once: true })
      const background = task.priority === 0 ? this.waiting.findIndex(item => item.priority > 0) : -1
      if (background >= 0) this.waiting.splice(background, 0, task)
      else this.waiting.push(task)
      stopPromotion = options.onPromote?.(() => {
        const index = this.waiting.indexOf(task)
        if (index < 0 || task.priority === 0) return
        this.waiting.splice(index, 1); task.priority = 0
        const background = this.waiting.findIndex(item => item.priority > 0)
        this.waiting.splice(background < 0 ? this.waiting.length : background, 0, task)
      })
      this.drain()
    })
  }
  promote(key: string): void {
    const index = this.waiting.findIndex(task => task.key === key && task.priority > 0)
    if (index < 0) return
    const [task] = this.waiting.splice(index, 1)
    task.priority = 0
    const background = this.waiting.findIndex(item => item.priority > 0)
    this.waiting.splice(background < 0 ? this.waiting.length : background, 0, task)
  }
  private drain(): void {
    while (this.running < this.limit && this.waiting.length) this.waiting.shift()!.start()
  }
  get stats() { return { running: this.running, queued: this.waiting.length } }
}

/** Cancel this wait without cancelling another owner's shared operation. */
export function cancellable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(signal.reason ?? abortError())
  return new Promise((resolve, reject) => {
    const abort = () => { cleanup(); reject(signal.reason ?? abortError()) }
    const cleanup = () => signal.removeEventListener('abort', abort)
    signal.addEventListener('abort', abort, { once: true })
    promise.then(value => { cleanup(); resolve(value) }, error => { cleanup(); reject(error) })
  })
}

/** Bounded document/instance preparation; wait for all owners to settle before returning. */
export async function forEachConcurrent<T>(items: readonly T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (cursor < items.length) await work(items[cursor++])
  })
  const results = await Promise.allSettled(workers)
  for (const result of results) if (result.status === 'rejected') throw result.reason
}
