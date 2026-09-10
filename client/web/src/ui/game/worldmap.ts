/** Geometry of the official world map: zoom pyramid, tiles, hint pins.

    `Picto/Worldmaps/worldmap_assets_.bundle` is a tile pyramid, not one picture
    per world map: the extractor writes it back out as
    `worldmaps/<id>/<zoom>/<index>.jpg`, indices **1-based, row-major from the
    top-left**, 1024² except on the last row and column. Everything here derives
    from `worldmaps.json` — `totalWidth` × `totalHeight` scaled by one of the
    row's `zoom` steps — so the grid needs no second index to be trusted. */

import { worldmap, worldmapHintsFor, type CatalogHint, type CatalogWorldmap } from './catalog'

export const WORLDMAP_TILE_SIZE = 1024

export type WorldmapLevel = {
  /** Scale of this level against the world map's own pixel space. */
  zoom: number
  /** The zoom exactly as the addressable spells it (`1`, `0.75`, `0.2`). */
  key: string
  width: number
  height: number
  columns: number
  rows: number
}

export type WorldmapTile = {
  key: string
  url: string
  /** Placement in the level's own pixel space. */
  left: number
  top: number
  width: number
  height: number
}

/** `0.800000011920929` (float32 in the DataRoot) is addressed as `0.8`. */
export function worldmapZoomKey(zoom: number): string {
  return String(Number(zoom.toFixed(4)))
}

export function worldmapLevels(worldmapId: number): WorldmapLevel[] {
  const meta = worldmap(worldmapId)
  if (!meta?.totalWidth || !meta.totalHeight) return []
  const zooms = meta.zoom?.length ? meta.zoom : [1]
  return zooms
    .map((zoom) => {
      const width = Math.round(meta.totalWidth! * zoom)
      const height = Math.round(meta.totalHeight! * zoom)
      return {
        zoom,
        key: worldmapZoomKey(zoom),
        width,
        height,
        columns: Math.max(1, Math.ceil(width / WORLDMAP_TILE_SIZE)),
        rows: Math.max(1, Math.ceil(height / WORLDMAP_TILE_SIZE)),
      }
    })
    .sort((a, b) => b.zoom - a.zoom)
}

/** The level the official view would ask for at `scale`.

    Never below the requested scale while one exists: upscaling a level blurs,
    downscaling it only wastes bandwidth. */
export function worldmapLevelFor(worldmapId: number, scale: number): WorldmapLevel | undefined {
  const levels = worldmapLevels(worldmapId)
  if (!levels.length) return undefined
  for (let index = levels.length - 1; index >= 0; index -= 1) {
    if (levels[index].zoom >= scale) return levels[index]
  }
  return levels[0]
}

/** Tiles of `level` that intersect `view`, expressed in the level's pixels. */
export function worldmapTiles(
  worldmapId: number,
  level: WorldmapLevel,
  view: { x: number; y: number; width: number; height: number },
): WorldmapTile[] {
  const firstColumn = Math.max(0, Math.floor(view.x / WORLDMAP_TILE_SIZE))
  const lastColumn = Math.min(level.columns - 1, Math.floor((view.x + view.width) / WORLDMAP_TILE_SIZE))
  const firstRow = Math.max(0, Math.floor(view.y / WORLDMAP_TILE_SIZE))
  const lastRow = Math.min(level.rows - 1, Math.floor((view.y + view.height) / WORLDMAP_TILE_SIZE))
  const tiles: WorldmapTile[] = []
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const index = row * level.columns + column + 1
      const left = column * WORLDMAP_TILE_SIZE
      const top = row * WORLDMAP_TILE_SIZE
      tiles.push({
        key: `${level.key}:${index}`,
        url: `/game-data/worldmaps/${worldmapId}/${level.key}/${index}.jpg`,
        left,
        top,
        width: Math.min(WORLDMAP_TILE_SIZE, level.width - left),
        height: Math.min(WORLDMAP_TILE_SIZE, level.height - top),
      })
    }
  }
  return tiles
}

export type WorldmapPoint = { x: number; y: number }

/** Map coordinates → the **top-left** of that map's cell, in world-map pixels.

    Verified against `output/ui_shots/official/hud_map.png`: matching the
    parchment by cross-correlation puts the official `currenMapHighlight` frame
    of Incarnam `[6,1]` on `origine + (6, 1) × mapSize` ± 3 px, covering exactly
    one `mapWidth × mapHeight` cell. `origine` is therefore a corner, not a
    centre — reading it as a centre shifts everything half a map. */
export function mapToWorldmapPixel(meta: CatalogWorldmap, x: number, y: number): WorldmapPoint {
  return {
    x: (meta.origineX ?? 0) + x * (meta.mapWidth ?? 0),
    y: (meta.origineY ?? 0) + y * (meta.mapHeight ?? 0),
  }
}

/** Middle of a map's cell: where a hint pin sits and what the views centre on.

    Same capture: the official hint icons land on the cell centre, and the
    MINI-CARTE is centred on the player's cell centre (2 px off over Incarnam,
    both axes), not on the cell corner. */
export function mapCellCenter(meta: CatalogWorldmap, x: number, y: number): WorldmapPoint {
  const corner = mapToWorldmapPixel(meta, x, y)
  return {
    x: corner.x + (meta.mapWidth ?? 0) / 2,
    y: corner.y + (meta.mapHeight ?? 0) / 2,
  }
}

/** World-map pixels → map coordinates, for a click on the parchment. */
export function worldmapPixelToMap(meta: CatalogWorldmap, x: number, y: number): WorldmapPoint {
  const width = meta.mapWidth || 1
  const height = meta.mapHeight || 1
  return {
    x: Math.floor((x - (meta.origineX ?? 0)) / width),
    y: Math.floor((y - (meta.origineY ?? 0)) / height),
  }
}

export type WorldmapPin = CatalogHint & { pixelX: number; pixelY: number }

/** Group only hints on the same map cell, after category filtering. */
export function groupWorldmapPins(pins: WorldmapPin[]): WorldmapPin[][] {
  const groups = new Map<string, WorldmapPin[]>()
  for (const pin of pins) {
    const key = `${pin.worldMapId}:${pin.x}:${pin.y}`
    const group = groups.get(key)
    if (group) group.push(pin)
    else groups.set(key, [pin])
  }
  return [...groups.values()]
}

/** `hints.json` placed on the parchment, filtered to the shown categories. */
export function worldmapPins(worldmapId: number, categories?: ReadonlySet<number>): WorldmapPin[] {
  const meta = worldmap(worldmapId)
  if (!meta) return []
  const pins: WorldmapPin[] = []
  for (const hint of worldmapHintsFor(worldmapId)) {
    if (categories && !categories.has(hint.categoryId)) continue
    const point = mapCellCenter(meta, hint.x, hint.y)
    pins.push({ ...hint, pixelX: point.x, pixelY: point.y })
  }
  return pins
}

export function worldmapHintIcon(gfx: number): string {
  return `/game-data/worldmaps/hints/${gfx}.png`
}

/** The twelve `#ctr_filters` rows of `CartographyMapUI`.

    The twelve rows the UXML ships and the twelve `hintcategories.json` rows the
    DataRoot carries are the same twelve, in the same order.

    Each row is `#ctr_filter<Name>` holding `#tx_filter<Name>` (the picto) and
    `#chbx_filter<Name>` (a checkbox and its caption). The official capture
    `output/ui_shots/official/hud_map.png` shows the strip as pictos only, and
    every picto ships an `_On` **and** an `_Off` variant — so the icon carries
    the state and the checkbox line is what C# folds away. `sprite` is that
    pair's stem, exactly as the UXML spells it in the row's rest pose. */
export type HintFilter = { category: number; sprite: string }

export const HINT_FILTERS: Record<string, HintFilter> = {
  Flags: { category: 8, sprite: 'filterRepere' },
  Transport: { category: 9, sprite: 'filterZaap' },
  Dungeon: { category: 6, sprite: 'filterDungeon' },
  Quest: { category: 11, sprite: 'filterQuest' },
  RepeatableQuest: { category: 12, sprite: 'filterRepeatableQuest' },
  BidHouse: { category: 2, sprite: 'filterAH' },
  CraftHouse: { category: 3, sprite: 'filterWork' },
  Temple: { category: 1, sprite: 'filterTemple' },
  Misc: { category: 4, sprite: 'filterMisc' },
  Private: { category: 7, sprite: 'filterHouse' },
  Prism: { category: 5, sprite: 'filterPrism' },
  Anomaly: { category: 10, sprite: 'filterSpiral' },
}

export const HINT_CATEGORY_IDS: number[] = Object.values(HINT_FILTERS).map((row) => row.category)

const FILTER_BINDING = /^(ctr|chbx|tx)_filter(.+)$/

/** `(part, filter)` for any of a row's three bindings, or undefined. */
export function hintFilterBinding(binding: string): { part: string; filter: HintFilter } | undefined {
  const match = FILTER_BINDING.exec(binding)
  const filter = match ? HINT_FILTERS[match[2]] : undefined
  return match && filter ? { part: match[1], filter } : undefined
}

export function hintFilterSprite(filter: HintFilter, on: boolean): string {
  return `styles/images/${filter.sprite}_${on ? 'On' : 'Off'}.png`
}
