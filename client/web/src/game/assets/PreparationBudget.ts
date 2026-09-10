import { cancellable, throwIfAborted, type LoadOptions } from './TaskQueue'

/** Cooperative CPU budget shared by actor, portrait and map preparation. */
export class PreparationBudget {
  private resumedAt: number
  private pending?: Promise<void>
  private now: () => number
  private yieldTask: () => Promise<void>
  constructor(now = () => performance.now(), yieldTask = () => new Promise<void>(resolve => setTimeout(resolve, 0))) {
    this.now = now; this.yieldTask = yieldTask; this.resumedAt = now()
  }
  async checkpoint(options: LoadOptions = {}): Promise<void> {
    throwIfAborted(options.signal)
    if (!this.pending && this.now() - this.resumedAt < (options.priority === 'background' ? 1 : 3)) return
    this.pending ??= this.yieldTask().finally(() => { this.resumedAt = this.now(); this.pending = undefined })
    await cancellable(this.pending, options.signal)
    throwIfAborted(options.signal)
  }
}
export const preparationBudget = new PreparationBudget()
