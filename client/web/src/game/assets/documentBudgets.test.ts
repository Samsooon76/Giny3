import { expect, it } from 'vitest'
import { DocumentCache } from './DocumentCache'
import { documentBudgetStats, registerDocumentCache } from './documentBudgets'
import { graphicsSettings } from '../graphicsSettings'
it('trims caches on economic mode and restores their capacity with the selected profile', async () => {
  const previous = graphicsSettings.snapshot()
  graphicsSettings.set('balanced')
  const cache = new DocumentCache<string, string>(10, 10, value => value.length)
  registerDocumentCache('test-cache', cache)
  try {
    await cache.get('first', async () => '1234'); await cache.get('second', async () => '5678')
    expect(cache.stats.estimatedBytes).toBe(8)
    graphicsSettings.set('low')
    expect(cache.stats).toMatchObject({ budget: 5, estimatedBytes: 4, entries: 1 })
    graphicsSettings.set('high')
    expect(documentBudgetStats()['test-cache'].budget).toBe(15)
    graphicsSettings.set('balanced')
    expect(cache.stats.budget).toBe(10)
  } finally { cache.clear(); graphicsSettings.set(previous) }
})
