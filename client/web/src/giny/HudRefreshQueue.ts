/** Coalesces notification bursts and preserves changes arriving during a request. */
export class HudRefreshQueue {
  private timer: ReturnType<typeof setTimeout> | undefined
  private running = false
  private dirty = false
  private generation = 0
  private refresh: () => Promise<unknown>
  constructor(refresh: () => Promise<unknown>) { this.refresh = refresh }
  request(): void {
    this.dirty = true
    if (this.timer || this.running) return
    const generation = this.generation
    this.timer = setTimeout(() => {
      this.timer = undefined; this.dirty = false; this.running = true
      void Promise.resolve().then(this.refresh).catch(() => undefined).finally(() => {
        if (generation !== this.generation) return
        this.running = false
        if (this.dirty) this.request()
      })
    }, 100)
  }
  reset(): void {
    this.generation++
    clearTimeout(this.timer); this.timer = undefined; this.dirty = false; this.running = false
  }
}
