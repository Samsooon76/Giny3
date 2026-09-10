import { expect, it } from 'vitest'
import { forEachConcurrent, TaskQueue } from './TaskQueue'

it('promotes a queued speculative asset once a visible owner requests it', async () => {
  const queue = new TaskQueue(1)
  let unblock!: () => void
  const hold = queue.run(() => new Promise<void>(resolve => { unblock = resolve }))
  const order: string[] = []
  const first = queue.run(async () => { order.push('first') }, { priority: 'background', key: 'first' })
  const promoted = queue.run(async () => { order.push('visible') }, { priority: 'background', key: 'visible' })
  queue.promote('visible')
  await Promise.resolve()
  unblock()
  await Promise.all([hold, first, promoted])
  expect(order).toEqual(['visible', 'first'])
})

it('bounds independent preparation without leaving a failed worker running after return', async () => {
  let active = 0, peak = 0, settled = 0
  await expect(forEachConcurrent([1, 2, 3, 4], 2, async id => {
    active++; peak = Math.max(peak, active)
    await Promise.resolve()
    active--; settled++
    if (id === 1) throw new Error('failed')
  })).rejects.toThrow('failed')
  expect(peak).toBe(2)
  expect(active).toBe(0)
  expect(settled).toBe(4)
})
