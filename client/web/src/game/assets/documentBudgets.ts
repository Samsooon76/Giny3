import { graphicsSettings } from '../graphicsSettings'
type Cache = { evictCached(): void; setTrackingName(name: string): void; setBudget(bytes: number): void; readonly stats: { entries: number; estimatedBytes: number; budget: number } }
const caches = new Map<string, { cache: Cache; balancedBudget: number }>()
const factor = () => graphicsSettings.snapshot() === 'low' ? .5 : graphicsSettings.snapshot() === 'high' ? 1.5 : 1
export function registerDocumentCache(name: string, cache: Cache): void {
  cache.setTrackingName(name)
  const balancedBudget = cache.stats.budget
  caches.set(name, { cache, balancedBudget })
  cache.setBudget(Math.floor(balancedBudget * factor()))
}
graphicsSettings.subscribe(() => {
  for (const { cache, balancedBudget } of caches.values()) cache.setBudget(Math.floor(balancedBudget * factor()))
})
/** Cache retention estimates only: objects retained by scenes are separate owners. */
export function documentBudgetStats() {
  return Object.fromEntries([...caches].map(([name, { cache }]) => [name, cache.stats]))
}

export function evictDocumentCaches(): void { for (const { cache } of caches.values()) cache.evictCached() }
