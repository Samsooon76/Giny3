import { expect, it } from 'vitest'
import { DocumentCache } from './DocumentCache'
import { documentOwnershipStats, retainDocument } from './documentOwnership'
it('keeps an evicted document accounted until its final scene owner releases it', async () => {
  const cache = new DocumentCache<string, object>(1, 100, () => 40)
  cache.setTrackingName('ownership-test')
  const document = await cache.get('one', async () => ({}))
  const centre = retainDocument(document, 'scene:test-centre', 40)
  const neighbour = retainDocument(document, 'scene:test-neighbour', 40)
  expect(documentOwnershipStats()).toMatchObject({ documents: 1, estimatedBytes: 40, outsideCachesBytes: 0 })
  cache.clear()
  expect(documentOwnershipStats()).toMatchObject({ documents: 1, estimatedBytes: 40, outsideCachesBytes: 40 })
  centre(); centre()
  expect(documentOwnershipStats().documents).toBe(1)
  neighbour()
  expect(documentOwnershipStats()).toMatchObject({ documents: 0, estimatedBytes: 0 })
})
it('evicts completed cache references under pressure without aborting in-flight owners', async () => {
  const cache = new DocumentCache<string, object>(4, 100, () => 40)
  cache.setTrackingName('pressure-test')
  const document = await cache.get('ready', async () => ({}))
  const release = retainDocument(document, 'scene:pressure-test', 40)
  let complete!: (value: object) => void
  let signal!: AbortSignal
  const pending = cache.get('pending', loadSignal => { signal = loadSignal; return new Promise<object>(resolve => { complete = resolve }) })
  cache.evictCached()
  expect(cache.stats).toMatchObject({ entries: 1, estimatedBytes: 0 })
  expect(signal.aborted).toBe(false)
  expect(documentOwnershipStats().outsideCachesBytes).toBe(40)
  complete({}); await pending
  expect(cache.stats.estimatedBytes).toBe(40)
  release(); cache.clear()
  expect(documentOwnershipStats().documents).toBe(0)
})
