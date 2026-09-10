import { afterEach, expect, it, vi } from 'vitest'
import { loadEntityLook } from './loader'
import { entityManifest, entityPublication, invalidateEntityManifest } from './clipLoader'
import { entityDocumentCandidates } from './look'

vi.mock('../../debug/sessionLogger', () => ({ logEvent: vi.fn() }))
afterEach(() => { invalidateEntityManifest(); vi.unstubAllGlobals() })

it('replaces an already cached look after its prepared document is republished', async () => {
  invalidateEntityManifest()
  const look = '{1|10}'
  const relative = entityDocumentCandidates(look)[0]
  let revision = 'old'
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('entities-manifest.json')) return new Response(JSON.stringify({
      format: 'giny.entity-clips.v1', entities: { [relative]: `optimized/${revision}.json` }, previews: {},
    }))
    return new Response(JSON.stringify({ format: 'giny.dofus3.entity.v2', frame_rate: revision === 'old' ? 20 : 30,
      animations: { idle: { frames: [[]] } }, parts: {} }))
  })
  vi.stubGlobal('fetch', fetchMock)
  const old = await loadEntityLook(look)
  expect((await loadEntityLook(look))).toBe(old)
  revision = 'repaired'
  invalidateEntityManifest()
  const repaired = await loadEntityLook(look)
  expect(repaired).not.toBe(old)
  expect(repaired.frameRate).toBe(30)
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/optimized/repaired.json'))).toBe(true)
})

it('does not let an obsolete manifest response change the current publication identity', async () => {
  invalidateEntityManifest()
  let resolve!: (response: Response) => void
  const manifest = (name: string) => new Response(JSON.stringify({ format: 'giny.entity-clips.v1', entities: { test: name }, previews: {} }))
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise<Response>(r => { resolve = r })).mockResolvedValue(manifest('new')))
  const old = entityManifest()
  await Promise.resolve()
  invalidateEntityManifest()
  const current = await entityPublication()
  resolve(manifest('old'))
  await old
  expect(await entityPublication()).toBe(current)
  expect((await entityManifest())?.entities.test).toBe('new')
})
