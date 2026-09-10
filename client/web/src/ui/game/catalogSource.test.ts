import { beforeEach, expect, it, vi } from 'vitest'
import { catalogJson, resetCatalogSources } from './catalogSource'
import { item, loadGameCatalog, resetCatalog } from './catalog'
beforeEach(() => { resetCatalog(); resetCatalogSources() })
it('defers window tables and reuses decoded core tables across consumers', async () => {
  const fetcher = vi.fn(async (path: string) => new Response(JSON.stringify(path.endsWith('/items.json') ? { '7': { id: 7, name: 'Test' } } : {}))) as unknown as typeof fetch
  await loadGameCatalog(fetcher, 'core')
  const calls = () => vi.mocked(fetcher).mock.calls.map(([path]) => String(path))
  expect(calls()).toHaveLength(22)
  expect(calls().some(path => path.includes('achievements.json'))).toBe(false)
  await Promise.all([loadGameCatalog(fetcher, 'achievements'), loadGameCatalog(fetcher, 'achievements')])
  expect(calls()).toHaveLength(24)
  expect(item(7)?.name).toBe('Test')
  await catalogJson('/game-data/data/items.json', fetcher)
  expect(calls().filter(path => path.endsWith('/items.json'))).toHaveLength(1)
  await loadGameCatalog(fetcher, 'all')
  expect(calls()).toHaveLength(28)
})
it('retries failed HTTP reads without repeating successful tables', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValue(new Response('{"ok":true}')) as typeof fetch
  await expect(catalogJson('/retry.json', fetcher)).rejects.toThrow('503')
  expect(await catalogJson('/retry.json', fetcher)).toEqual({ ok: true })
  await catalogJson('/retry.json', fetcher)
  expect(fetcher).toHaveBeenCalledTimes(2)
})
