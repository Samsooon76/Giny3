/** Ordered, cancellable presentation. A missing asset can never hold the server indefinitely. */
export class CombatSequencer {
  private tail: Promise<void> = Promise.resolve()
  private controller = new AbortController()
  private pending = 0
  private changed: (busy: boolean) => void
  private failed: (error: unknown) => void
  constructor(changed: (busy: boolean) => void, failed: (error: unknown) => void) { this.changed = changed; this.failed = failed }
  enqueue(task: (signal: AbortSignal) => Promise<void>, settled: () => void = () => undefined): void {
    const controller = this.controller
    const queuedAt = Date.now()
    this.pending++; this.changed(true)
    this.tail = this.tail.then(async () => {
      if (controller.signal.aborted) return
      const step = new AbortController()
      const abort = () => step.abort()
      controller.signal.addEventListener('abort', abort, { once: true })
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          task(step.signal),
          new Promise<void>(resolve => {
            step.signal.addEventListener('abort', () => resolve(), { once: true })
            // Catch up after a suspended tab or a burst of effects. Continue
            // processing checkpoints and acknowledgements in their original order.
            timer = setTimeout(() => { step.abort(); resolve() }, this.pending > 40 || Date.now() - queuedAt > 3000 ? 80 : 4500)
          }),
        ])
      } catch (error) { this.failed(error) }
      finally {
        clearTimeout(timer); step.abort(); controller.signal.removeEventListener('abort', abort)
        if (!controller.signal.aborted) {
          try { settled() } catch (error) { this.failed(error) }
          finally { this.pending--; this.changed(this.pending > 0) }
        }
      }
    })
  }
  reset(): void { this.controller.abort(); this.controller = new AbortController(); this.tail = Promise.resolve(); this.pending = 0; this.changed(false) }
  /** Resolve when every task enqueued so far has settled. Checkpoints use this
      as an explicit end-of-action barrier instead of guessing completion. */
  drain(): Promise<void> { return this.tail }
  /** Enqueue a causal marker so a group of ordered steps (signal, reaction,
      resource variations) can share one barrier without parallelizing steps
      the official sequence did not confirm as parallel. */
  barrier(settled: () => void = () => undefined): void { this.enqueue(async () => undefined, settled) }
}
