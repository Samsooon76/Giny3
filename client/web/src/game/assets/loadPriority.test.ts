import { expect, it } from 'vitest'
import { DocumentCache } from './DocumentCache'
import { TaskQueue } from './TaskQueue'
it.each([false, true])('promotes a shared look through a child document (queued=%s)', async queued => {
  const queue = new TaskQueue(1)
  const looks = new DocumentCache<string, string>(4, 100, () => 1)
  const documents = new DocumentCache<string, string>(4, 100, () => 1)
  let releaseQueue!: () => void, releaseManifest!: () => void
  const hold = queue.run(() => new Promise<void>(resolve => { releaseQueue = resolve }))
  const manifest = new Promise<void>(resolve => { releaseManifest = resolve })
  const order: string[] = []
  const background = queue.run(async () => { order.push('background') }, { priority: 'background' })
  let builds = 0
  const look = looks.get('look', async (_signal, context) => {
    builds++
    await manifest
    return documents.get('document', (_childSignal, childContext) => queue.run(async () => {
      order.push('visible'); return 'loaded'
    }, childContext), context)
  }, { priority: 'background' })
  if (queued) { releaseManifest(); await Promise.resolve(); await Promise.resolve() }
  const visible = looks.get('look', async () => { throw new Error('Duplicate look load') })
  releaseManifest(); await Promise.resolve(); await Promise.resolve()
  releaseQueue()
  await Promise.all([hold, background])
  expect(await look).toBe('loaded'); expect(await visible).toBe('loaded')
  expect(builds).toBe(1)
  expect(order).toEqual(['visible', 'background'])
})
