import { worldmapViewStore } from './worldmapStore'
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { hydrateCatalog, resetCatalog } from './catalog'
import {
  groupWorldmapPins, HINT_CATEGORY_IDS, hintFilterBinding, hintFilterSprite, mapCellCenter, mapToWorldmapPixel,
  worldmapHintIcon, worldmapLevelFor, worldmapLevels, worldmapPins, worldmapPixelToMap,
  worldmapTiles, worldmapZoomKey,
} from './worldmap'
import { MINIMAP_MAPS_ACROSS } from './MinimapView'

/** The two rows the official capture was measured against. */
const WORLDMAPS = {
  // Le Monde des Douze: float32 zooms, the ones that print as 0.800000011920929.
  '1': {
    id: 1, origineX: 6480, origineY: 4944, mapWidth: 69.5, mapHeight: 49.7,
    totalWidth: 10000, totalHeight: 8000, minScale: 0.2, maxScale: 1, startScale: 0.6,
    zoom: [1, 0.800000011920929, 0.6000000238418579, 0.4000000059604645, 0.20000000298023224],
    visibleOnMap: 1, name: 'Monde des Douze',
  },
  '2': {
    id: 2, origineX: 1800, origineY: 1940, mapWidth: 380, mapHeight: 260,
    totalWidth: 4750, totalHeight: 3904, minScale: 0.25, maxScale: 1, startScale: 0.25,
    zoom: [1, 0.75, 0.5, 0.25], visibleOnMap: 1, name: 'Incarnam',
  },
}

beforeEach(() => {
  resetCatalog()
  hydrateCatalog({ worldmaps: WORLDMAPS })
})
afterEach(() => resetCatalog())

describe('worldmap zoom pyramid', () => {
  it('spells a float32 zoom the way the addressable does', () => {
    expect(worldmapZoomKey(0.800000011920929)).toBe('0.8')
    expect(worldmapZoomKey(0.20000000298023224)).toBe('0.2')
    expect(worldmapZoomKey(1)).toBe('1')
  })

  it('rebuilds the exact grid the bundle ships, largest level first', () => {
    const levels = worldmapLevels(1)
    expect(levels.map((level) => level.key)).toEqual(['1', '0.8', '0.6', '0.4', '0.2'])
    // 80 + 56 + 30 + 16 + 4 = 186 tiles, which is what the catalog addresses.
    expect(levels.map((level) => level.columns * level.rows)).toEqual([80, 56, 30, 16, 4])
    expect(levels[0]).toMatchObject({ width: 10000, height: 8000, columns: 10, rows: 8 })
    expect(worldmapLevels(2).map((level) => level.columns * level.rows)).toEqual([20, 12, 6, 2])
  })

  it('never picks a level below the requested scale while one exists', () => {
    expect(worldmapLevelFor(2, 1)?.key).toBe('1')
    expect(worldmapLevelFor(2, 0.6)?.key).toBe('0.75')
    expect(worldmapLevelFor(2, 0.25)?.key).toBe('0.25')
    // Below the smallest level there is nothing left to downscale to.
    expect(worldmapLevelFor(2, 0.05)?.key).toBe('0.25')
  })

  it('addresses tiles 1-based, row-major, and crops the last row and column', () => {
    const level = worldmapLevelFor(2, 1)!
    const tiles = worldmapTiles(2, level, { x: 0, y: 0, width: level.width, height: level.height })
    expect(tiles).toHaveLength(20)
    expect(tiles[0]).toMatchObject({ url: '/game-data/worldmaps/2/1/1.jpg', left: 0, top: 0, width: 1024, height: 1024 })
    // Column 5 is 4750 - 4 × 1024 = 654 wide, row 4 is 3904 - 3 × 1024 = 832 tall.
    expect(tiles[4]).toMatchObject({ url: '/game-data/worldmaps/2/1/5.jpg', left: 4096, width: 654 })
    expect(tiles[19]).toMatchObject({ url: '/game-data/worldmaps/2/1/20.jpg', top: 3072, height: 832 })
  })

  it('only asks for the tiles the viewport crosses', () => {
    const level = worldmapLevelFor(2, 1)!
    const tiles = worldmapTiles(2, level, { x: 0, y: 0, width: 100, height: 100 })
    expect(tiles.map((tile) => tile.url)).toEqual(['/game-data/worldmaps/2/1/1.jpg'])
  })
})

describe('worldmap anchors', () => {
  it('groups hints on the same cell while keeping neighbouring maps and filters separate', () => {
    hydrateCatalog({ worldmaps: WORLDMAPS, hints: {
      '1': { id: 1, categoryId: 6, gfx: 412, x: 3, y: -4, worldMapId: 2 },
      '2': { id: 2, categoryId: 9, gfx: 445, x: 3, y: -4, worldMapId: 2 },
      '3': { id: 3, categoryId: 6, gfx: 412, x: 4, y: -4, worldMapId: 2 },
      '4': { id: 4, categoryId: 6, gfx: 412, x: 3, y: -4, worldMapId: 1 },
    } })
    expect(groupWorldmapPins(worldmapPins(2)).map(group => group.map(pin => pin.id))).toEqual([[1, 2], [3]])
    expect(groupWorldmapPins(worldmapPins(2, new Set([9]))).map(group => group.map(pin => pin.id))).toEqual([[2]])
    expect(groupWorldmapPins([...worldmapPins(2), ...worldmapPins(1)])).toHaveLength(3)
    expect(groupWorldmapPins([])).toEqual([])
  })

  it('reads origine as the map cell corner, not its middle', () => {
    // `output/ui_shots/official/hud_map.png`: the `currenMapHighlight` frame of
    // Incarnam [6,1] starts at this pixel and covers one 380 × 260 cell.
    expect(mapToWorldmapPixel(WORLDMAPS['2'], 6, 1)).toEqual({ x: 4080, y: 2200 })
    expect(mapCellCenter(WORLDMAPS['2'], 6, 1)).toEqual({ x: 4270, y: 2330 })
    expect(mapToWorldmapPixel(WORLDMAPS['1'], 2, -4)).toEqual({ x: 6619, y: 4944 - 4 * 49.7 })
  })

  it('round-trips a pixel back to the map it belongs to', () => {
    const middle = mapCellCenter(WORLDMAPS['2'], -3, 5)
    expect(worldmapPixelToMap(WORLDMAPS['2'], middle.x, middle.y)).toEqual({ x: -3, y: 5 })
  })

  it('puts a hint on the middle of its map and honours the filters', () => {
    hydrateCatalog({
      worldmaps: WORLDMAPS,
      hints: {
        '1': { id: 1, categoryId: 6, gfx: 412, x: 6, y: 1, worldMapId: 2, name: 'Donjon' },
        '2': { id: 2, categoryId: 9, gfx: 445, x: 0, y: 0, worldMapId: 2 },
        '3': { id: 3, categoryId: 6, gfx: 412, x: 0, y: 0, worldMapId: 1 },
      },
    })
    const all = worldmapPins(2)
    expect(all.map((pin) => pin.id)).toEqual([1, 2])
    expect(all[0]).toMatchObject({ pixelX: 4270, pixelY: 2330 })
    expect(worldmapPins(2, new Set([9])).map((pin) => pin.id)).toEqual([2])
    expect(worldmapHintIcon(412)).toBe('/game-data/worldmaps/hints/412.png')
  })
})

describe('cartography filters', () => {
  it('maps the twelve UXML rows onto the twelve hint categories', () => {
    const categories = HINT_CATEGORY_IDS
    expect(categories).toHaveLength(12)
    expect(new Set(categories).size).toBe(12)
    expect(categories.slice().sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('reads a row from any of its three bindings and swaps the On/Off picto', () => {
    const row = hintFilterBinding('tx_filterTransport')
    expect(row).toMatchObject({ part: 'tx', filter: { category: 9, sprite: 'filterZaap' } })
    expect(hintFilterBinding('chbx_filterTransport')?.part).toBe('chbx')
    expect(hintFilterBinding('ctr_filterTransport')?.part).toBe('ctr')
    expect(hintFilterBinding('ctr_filterNope')).toBeUndefined()
    expect(hintFilterBinding('mapView')).toBeUndefined()
    expect(hintFilterSprite(row!.filter, true)).toBe('styles/images/filterZaap_On.png')
    expect(hintFilterSprite(row!.filter, false)).toBe('styles/images/filterZaap_Off.png')
  })
})

describe('minimap framing', () => {
  it('matches the official capture: 660 px over Incarnam spans five maps', () => {
    const officialWidth = 660
    const scale = officialWidth / (MINIMAP_MAPS_ACROSS * WORLDMAPS['2'].mapWidth)
    // Cross-correlating the widget against the parchment gave 0.34 ± one grid
    // step of the sweep; the fitted scale has to land inside that.
    expect(scale).toBeGreaterThan(0.33)
    expect(scale).toBeLessThan(0.36)
    // At that scale the 0.5 level is the one worth fetching, not the 1:1 one.
    expect(worldmapLevelFor(2, scale)?.key).toBe('0.5')
  })
})


it('zooms from the fitted parchment scale on the first click', () => {
  worldmapViewStore.reset()
  worldmapViewStore.open(2)
  worldmapViewStore.ensureVisibleScale(0.5)
  worldmapViewStore.zoomBy(1)
  expect(worldmapViewStore.snapshot().scale).toBe(0.625)
  worldmapViewStore.ensureVisibleScale(0.4)
  expect(worldmapViewStore.snapshot().scale).toBe(0.625)
  worldmapViewStore.reset()
})
