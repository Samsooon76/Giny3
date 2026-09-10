import { afterEach, expect, it, vi } from 'vitest'
import { loadTree } from './treeLoader'

afterEach(() => vi.unstubAllGlobals())
it('loads a named fragment from its source asset without fetching a fragment URL', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ type: 'UXML', children: [{ name: 'outer', children: [{ name: 'panel', binding: 'sidebar' }] }] }) })
  vi.stubGlobal('fetch', fetch)
  expect(await loadTree('example#sidebar')).toEqual({ type: 'UXML', children: [{ name: 'panel', binding: 'sidebar' }] })
  expect(fetch).toHaveBeenCalledWith('/ui-data/trees/example.json')
})
it('reports missing fragments instead of silently mounting an unrelated tree', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ type: 'UXML' }) }))
  await expect(loadTree('example#missing')).rejects.toThrow('example#missing')
})

vi.mock('virtual:giny-prepared-ui', () => ({ default: { compiledExample: '/ui-prepared/fixture.json' } }))

it('loads a compiled full document without repeating its stable transformations', async () => {
  const { loadPreparedTree } = await import('./treeLoader')
  const source = { type: 'UXML', style: { display: 'none' }, children: [] }
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => source })
  vi.stubGlobal('fetch', fetch)
  const first = await loadPreparedTree('compiledExample')
  first.style!.display = 'changed'
  expect(await loadPreparedTree('compiledExample')).toEqual(source)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('/ui-prepared/fixture.json')
})

it('rejects a missing compiled asset instead of silently reverting to a stale raw tree', async () => {
  const { loadPreparedTree } = await import('./treeLoader')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  await expect(loadPreparedTree('compiledExample')).rejects.toThrow('préparé compiledExample')
})

it('prepares dynamic fragments while leaving their source document raw', async () => {
  const { loadPreparedTree } = await import('./treeLoader')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ type: 'UXML', children: [{ binding: 'panel', style: { display: 'none' } }] }) }))
  const raw = await loadTree('dynamic#panel')
  expect(await loadPreparedTree('dynamic#panel')).toBeDefined()
  expect(await loadTree('dynamic#panel')).toEqual(raw)
})
