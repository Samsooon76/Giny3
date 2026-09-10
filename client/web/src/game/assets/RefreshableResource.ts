import { cancellable } from './TaskQueue'

/** Shared reads with bounded retry delay and explicit invalidation, without background timers. */
export class RefreshableResource<T> {
  private entry?: { promise: Promise<T | null>; expires: number }
  private failures = 0
  private load: () => Promise<T>
  private now: () => number
  private ttl: number
  private lastError: unknown
  constructor(load: () => Promise<T>, ttl = 30000, now = () => Date.now()) {
    this.load = load; this.ttl = ttl; this.now = now
  }
  get(signal?: AbortSignal): Promise<T | null> {
    if (signal?.aborted) return Promise.reject(signal.reason)
    if (!this.entry || this.now() >= this.entry.expires) {
      const entry = { promise: null as unknown as Promise<T | null>, expires: Infinity }
      this.entry = entry
      entry.promise = Promise.resolve().then(this.load).then(value => {
        if (this.entry === entry) {
          this.failures = 0; this.lastError = undefined; entry.expires = this.now() + this.ttl
        }
        return value
      }, error => {
        if (this.entry === entry) {
          this.lastError = error
          entry.expires = this.now() + Math.min(30000, 5000 * 2 ** Math.min(this.failures++, 3))
        }
        return null
      })
    }
    return cancellable(this.entry.promise, signal)
  }
  invalidate(): void { this.entry = undefined; this.failures = 0; this.lastError = undefined }
  get error(): unknown { return this.lastError }
}
