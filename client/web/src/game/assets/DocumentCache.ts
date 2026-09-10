import { retainDocument } from './documentOwnership'
import { cancellable, throwIfAborted, type LoadOptions } from './TaskQueue'

type Entry<V> = { releaseDocument?: () => void; value: Promise<V>; bytes: number; ready: boolean; owners: number; controller: AbortController; promote: () => void }
/** Bounded document LRU. In-flight work is shared until its last waiting owner leaves. */
export class DocumentCache<K, V> {
  private entries = new Map<K, Entry<V>>()
  private trackingName?: string
  private bytes = 0
  private readonly limit: number
  private budget: number
  private readonly sizeOf: (value: V) => number
  constructor(limit: number, budget: number, sizeOf: (value: V) => number) {
    this.limit = limit; this.budget = budget; this.sizeOf = sizeOf
  }
  get(key: K, load: (signal: AbortSignal, context: LoadOptions) => Promise<V>, options: LoadOptions = {}): Promise<V> {
    if (options.signal?.aborted) return Promise.reject(options.signal.reason)
    let entry = this.entries.get(key)
    if (entry) { this.entries.delete(key); this.entries.set(key, entry) }
    else {
      entry = { value: null as unknown as Promise<V>, bytes: 0, ready: false, owners: 0, controller: new AbortController(), promote: () => undefined }
      const created = entry
      this.entries.set(key, created)
      const listeners = new Set<() => void>()
      const context: LoadOptions = { signal: created.controller.signal, priority: options.priority,
        onPromote(listener) {
          if (context.priority !== 'background') listener()
          else listeners.add(listener)
          return () => { listeners.delete(listener) }
        } }
      created.promote = () => {
        if (context.priority !== 'background') return
        context.priority = 'active'
        for (const listener of [...listeners]) listener()
        listeners.clear()
      }
      let pending: Promise<V>
      try { pending = load(created.controller.signal, context) } catch (error) { pending = Promise.reject(error) }
      created.value = pending.finally(() => listeners.clear()).then(value => {
        throwIfAborted(created.controller.signal)
        if (this.entries.get(key) === created) {
          created.bytes = this.sizeOf(value); created.ready = true;
          if (this.trackingName && value !== null && typeof value === 'object') created.releaseDocument = retainDocument(value, `cache:${this.trackingName}`, created.bytes); this.bytes += created.bytes
          this.trim()
        }
        return value
      }).catch(error => { if (this.entries.get(key) === created) this.entries.delete(key); throw error })
    }
    const owned = entry
    if (options.priority !== 'background') owned.promote()
    const stopPromotion = options.onPromote?.(owned.promote)
    owned.owners++
    const release = () => {
      stopPromotion?.()
      owned.owners--
      if (!owned.ready && owned.owners === 0 && this.entries.get(key) === owned) {
        this.entries.delete(key); owned.controller.abort()
      }
    }
    const result = cancellable(owned.value, options.signal)
    // Preserve promise identity for callers without cancellation, including map coalescence.
    void result.then(release, release)
    return result
  }
  setTrackingName(name: string): void { this.trackingName = name }
  setBudget(bytes: number): void { this.budget = Math.max(0, bytes); this.trim() }
  evictCached(): void { this.trim(true) }
  private trim(allReady = false): void {
    for (const [key, entry] of this.entries) {
      if (!allReady && this.entries.size <= this.limit && this.bytes <= this.budget) break
      if (!entry.ready) continue
      this.entries.delete(key); this.bytes -= entry.bytes; entry.releaseDocument?.()
    }
  }
  clear(): void {
    for (const entry of this.entries.values()) { entry.releaseDocument?.(); if (!entry.ready) entry.controller.abort() }
    this.entries.clear(); this.bytes = 0
  }
  get stats() { return { entries: this.entries.size, estimatedBytes: this.bytes, budget: this.budget } }
}
