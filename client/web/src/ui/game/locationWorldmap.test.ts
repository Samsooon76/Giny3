import fs from 'node:fs'
import zlib from 'node:zlib'
import { beforeEach, describe, expect, it } from 'vitest'
import { hydrateCatalog, loadGameCatalog, locationWorldmapId, resetCatalog } from './catalog'
import { PREVIEW_HUD, resolveHud } from './hudBindings'
import { worldmapViewStore } from './worldmapStore'

beforeEach(() => {
  resetCatalog()
  worldmapViewStore.reset()
  hydrateCatalog({
    subareas: { '450': { id: 450, areaId: 45 } },
    areas: { '45': { id: 45, superAreaId: 3, worldmapId: 0 } },
    superareas: { '3': { id: 3, worldmapId: 2 } },
  })
})

describe('world-map inheritance', () => {
  it('resolves the real Incarnam snapshot with an inherited world_map_id of zero', () => {
    expect(locationWorldmapId({ world_map_id: 0, subarea_id: 450 })).toBe(2)
  })

  it('honours a positive world-map id provided by the server', () => {
    expect(locationWorldmapId({ world_map_id: 3, subarea_id: 450 })).toBe(3)
  })

  it('uses a local area override before its superarea', () => {
    hydrateCatalog({ areas: { '45': { id: 45, superAreaId: 3, worldmapId: 8 } } })
    expect(locationWorldmapId({ world_map_id: 0, subarea_id: 450 })).toBe(8)
  })

  it('uses a subarea override before its area', () => {
    hydrateCatalog({ subareas: { '450': { id: 450, areaId: 45, worldmapId: 9 } } })
    expect(locationWorldmapId({ subarea_id: 450 })).toBe(9)
  })

  it('falls back to the main world rather than the nonexistent parchment zero', () => {
    expect(locationWorldmapId({ world_map_id: 0, subarea_id: -1 })).toBe(1)
  })

  it('gives both HUD views the inherited world map', () => {
    const hud = { ...PREVIEW_HUD, map: { ...PREVIEW_HUD.map, world_map_id: 0, subarea_id: 450 } }
    for (const tree of ['CartographyMapUI', 'CartographyBannerUI']) {
      const child = resolveHud(tree, 'mapView', undefined, hud)?.children as { props: { worldmapId: number } }
      expect(child.props.worldmapId).toBe(2)
    }
  })

  it('loads the inheritance chain from the installed local catalogues', async () => {
    resetCatalog()
    const root = new URL('../../../../dofus3/output/data/', import.meta.url)
    const tables = new Set(['areas.json', 'subareas.json', 'superareas.json'])
    const fetcher: typeof fetch = async (input) => {
      const name = String(input).split('/').pop()!
      if (!tables.has(name)) return new Response('{}')
      const file = new URL(name, root)
      const bytes = fs.existsSync(file) ? fs.readFileSync(file) : zlib.gunzipSync(fs.readFileSync(new URL(name + '.gz', root)))
      return new Response(bytes.toString('utf8'))
    }
    await loadGameCatalog(fetcher)
    expect(locationWorldmapId({ world_map_id: 0, subarea_id: 450 })).toBe(2)
  })
})
