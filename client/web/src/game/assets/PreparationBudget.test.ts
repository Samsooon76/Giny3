import { expect, it, vi } from 'vitest'
import { PreparationBudget } from './PreparationBudget'
it('shares one yield across concurrent preparation and uses a smaller background slice', async () => {
  let time = 0, resume!: () => void
  const yieldTask = vi.fn(() => new Promise<void>(resolve => { resume = resolve }))
  const budget = new PreparationBudget(() => time, yieldTask)
  time = 2
  await budget.checkpoint()
  expect(yieldTask).not.toHaveBeenCalled()
  const background = budget.checkpoint({ priority: 'background' })
  const active = budget.checkpoint()
  expect(yieldTask).toHaveBeenCalledTimes(1)
  time = 10; resume(); await Promise.all([background, active])
  await budget.checkpoint()
  expect(yieldTask).toHaveBeenCalledTimes(1)
})
it('cancels one preparation without cancelling other users of the shared yield', async () => {
  let time = 0, resume!: () => void
  const budget = new PreparationBudget(() => time, () => new Promise<void>(resolve => { resume = resolve }))
  time = 4
  const controller = new AbortController()
  const cancelled = budget.checkpoint({ signal: controller.signal })
  const survivor = budget.checkpoint()
  controller.abort()
  await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
  resume(); await survivor
})
