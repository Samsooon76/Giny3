import { cancellable, TaskQueue, throwIfAborted, type LoadOptions } from './TaskQueue'
export class ResourceLimitError extends Error {
  readonly requestedBytes: number
  readonly limitBytes: number
  constructor(requestedBytes: number, limitBytes: number) {
    super('Budget maximal des textures atteint. Réduisez la qualité ou fermez les aperçus avant de réessayer.')
    this.name = 'ResourceLimitError'; this.requestedBytes = requestedBytes; this.limitBytes = limitBytes
  }
}
export type Lease<T> = { value: T; release: () => void }
type Entry<T> = { refs: number; bytes: number; value?: T; pending: Promise<T>; controller: AbortController }

/** Sources are shared across maps, actors and preview contexts. Never evict a
 * pinned source. The soft target evicts idle resources; an optional hard limit
 * rejects new sources before exposing them to owners. Decoding remains bounded
 * by queue concurrency and is reported separately from admitted sources. */
export class ResourcePool<T> {
  private entries = new Map<string, Entry<T>>()
  private retiring = new Map<string, Promise<void>>()
  private preparingBytes = 0
  private retiringBytes = 0
  private bytes = 0
  private idle = new Map<string, Entry<T>>()
  private evictions = 0
  private queue: TaskQueue
  private readonly load: (key: string, signal: AbortSignal) => Promise<T>
  private readonly dispose: (key: string, value: T) => Promise<void>
  private readonly sizeOf: (value: T) => number
  private hardLimit: number
  private rejected = 0
  private budget: number
  constructor(load: (key: string, signal: AbortSignal) => Promise<T>,
    dispose: (key: string, value: T) => Promise<void>, sizeOf: (value: T) => number,
    budget = 256 * 1024 * 1024, concurrency = 6, hardLimit = Infinity) {
    this.load = load; this.dispose = dispose; this.sizeOf = sizeOf; this.budget = budget
    this.hardLimit = hardLimit
    this.queue = new TaskQueue(concurrency)
  }

  async acquire(key: string, options: LoadOptions = {}): Promise<Lease<T>> {
    throwIfAborted(options.signal)
    let entry = this.entries.get(key)
    if (entry && options.priority !== 'background') this.queue.promote(key)
    if (entry?.controller.signal.aborted) {
      await cancellable(entry.pending.catch(() => undefined), options.signal)
      await this.retiring.get(key)
      return this.acquire(key, options)
    }
    if (!entry) {
      const controller = new AbortController()
      entry = { refs: 0, bytes: 0, pending: null as unknown as Promise<T>, controller }
      const created = entry
      this.entries.set(key, created)
      created.pending = this.queue.run(async () => {
        await this.retiring.get(key)
        throwIfAborted(controller.signal)
        const value = await this.load(key, controller.signal)
        const bytes = this.sizeOf(value)
        this.preparingBytes += bytes
        try {
          if (this.bytes + this.retiringBytes + bytes > this.hardLimit) {
            this.trim(true)
            await Promise.all(this.retiring.values())
            if (this.bytes + this.retiringBytes + bytes > this.hardLimit) {
              this.rejected++
              try { await this.dispose(key, value) } finally { if (this.entries.get(key) === created) this.entries.delete(key) }
              throw new ResourceLimitError(bytes, this.hardLimit)
            }
          }
          created.value = value; created.bytes = bytes; this.bytes += created.bytes
          if (controller.signal.aborted || this.entries.get(key) !== created) this.retire(key, created)
          else this.trim()
          return value
        } finally { this.preparingBytes -= bytes }
      }, { ...options, key, signal: controller.signal }).catch(error => { if (this.entries.get(key) === created) this.entries.delete(key); throw error })
    }
    const owned = entry
    owned.refs++; this.idle.delete(key)
    let released = false
    const release = () => {
      if (released) return
      released = true; owned.refs--
      if (owned.refs === 0 && !owned.value) {
        owned.controller.abort()
      } else if (owned.refs === 0 && owned.value && this.entries.get(key) === owned) {
        this.idle.delete(key); this.idle.set(key, owned)
      }
      this.trim()
    }
    try {
      const value = await cancellable(owned.pending, options.signal)
      throwIfAborted(options.signal)
      return { value, release }
    } catch (error) { release(); throw error }
  }
  private retire(key: string, entry: Entry<T>): void {
    if (!entry.value) return
    if (this.idle.get(key) === entry) this.idle.delete(key)
    if (this.entries.get(key) === entry) this.entries.delete(key)
    const value = entry.value; entry.value = undefined
    this.bytes -= entry.bytes; this.retiringBytes += entry.bytes; this.evictions++
    const pending = this.dispose(key, value).catch(() => undefined)
    this.retiring.set(key, pending)
    void pending.finally(() => { this.retiringBytes -= entry.bytes; if (this.retiring.get(key) === pending) this.retiring.delete(key) })
  }
  visitLoaded(visit: (value: T) => void): void {
    for (const entry of this.entries.values()) if (entry.value) visit(entry.value)
  }
  setBudget(bytes: number): void {
    this.budget = Math.max(0, bytes); this.trim()
  }
  trim(allUnused = false): void {
    if (!allUnused && this.bytes <= this.budget) return
    for (const [key, entry] of this.idle) {
      if (!allUnused && this.bytes <= this.budget) break
      this.retire(key, entry)
    }
  }
  get stats() {
    let pinned = 0, pinnedBytes = 0, loading = 0
    for (const entry of this.entries.values()) {
      if (entry.refs > 0) { pinned++; pinnedBytes += entry.bytes }
      if (!entry.value) loading++
    }
    return { entries: this.entries.size, bytes: this.bytes, budget: this.budget,
      pinned, pinnedBytes, idleBytes: this.bytes - pinnedBytes, loading, retiringBytes: this.retiringBytes,
      preparingBytes: this.preparingBytes, accountedBytes: this.bytes + this.retiringBytes + this.preparingBytes, hardLimitBytes: this.hardLimit, rejected: this.rejected,
      overBudgetBytes: Math.max(0, this.bytes - this.budget), evictions: this.evictions, ...this.queue.stats }
  }
}
