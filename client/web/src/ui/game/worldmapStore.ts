/** Shared pan / zoom / filter state of the official cartography view.

    `CartographyMapUI` scatters the controls: the parchment is `#mapView`, the
    zoom buttons live in `#zoomControls`, the twelve filters in `#ctr_filters`
    and the world-map picker in `#gd_worldmaps` — four sibling subtrees the
    binding resolver visits separately. They therefore talk through a store, the
    way `chatStore` and `chromeMenuStore` already do, instead of through props.

    Zoom is continuous between the row's `minScale` and `maxScale`: matching the
    official capture against the parchment puts it at 0.62 over Incarnam, and
    0.62 is not one of that world map's `zoom` steps — those are the tile
    levels, not the stops. The buttons therefore step by a fixed ratio and the
    pyramid level is chosen from the resulting scale. */

import { worldmap } from './catalog'
import { HINT_CATEGORY_IDS } from './worldmap'

type Listener = () => void

export type WorldmapViewState = {
  markers: { worldmapId: number; x: number; y: number }[]
  worldmapId: number
  /** World-map pixel at the centre of the viewport. */
  center: { x: number; y: number }
  /** World-map pixels per CSS pixel. */
  scale: number
  /** Hint categories currently painted. */
  filters: ReadonlySet<number>
  /** Re-centre on the player when the character changes map. */
  followPlayer: boolean
  /** `#ctr_worldmapList`, the picker `btn_worldmap` folds out. */
  pickerOpen: boolean
}

const ALL_FILTERS: ReadonlySet<number> = new Set(HINT_CATEGORY_IDS)

let state: WorldmapViewState = {
  markers: [],
  worldmapId: 0,
  center: { x: 0, y: 0 },
  scale: 1,
  filters: ALL_FILTERS,
  followPlayer: true,
  pickerOpen: false,
}

const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

function set(next: Partial<WorldmapViewState>) {
  state = { ...state, ...next }
  emit()
}

/** One press of `btn_zoomIn` / `btn_zoomOut`. */
export const ZOOM_STEP = 1.25

export function clampScale(worldmapId: number, scale: number): number {
  const meta = worldmap(worldmapId)
  const min = meta?.minScale ?? 0.1
  const max = meta?.maxScale ?? 1
  return Math.min(max, Math.max(min, scale))
}

function clampCenter(worldmapId: number, point: { x: number; y: number }) {
  const meta = worldmap(worldmapId)
  if (!meta?.totalWidth || !meta.totalHeight) return point
  return {
    x: Math.min(Math.max(point.x, 0), meta.totalWidth),
    y: Math.min(Math.max(point.y, 0), meta.totalHeight),
  }
}

export const worldmapViewStore = {
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  snapshot(): WorldmapViewState {
    return state
  },
  /** Open a world map at its `startScale`, centred on `focus`. */
  open(worldmapId: number, focus?: { x: number; y: number }) {
    if (state.worldmapId === worldmapId && !focus) return
    const meta = worldmap(worldmapId)
    const center = focus ?? {
      x: (meta?.totalWidth ?? 0) / 2,
      y: (meta?.totalHeight ?? 0) / 2,
    }
    set({
      worldmapId,
      center: clampCenter(worldmapId, center),
      scale: clampScale(worldmapId, meta?.startScale ?? 1),
      followPlayer: true,
    })
  },
  /** Switch parchment from the `gd_worldmaps` picker: no player to follow. */
  select(worldmapId: number) {
    if (state.worldmapId === worldmapId) return
    const meta = worldmap(worldmapId)
    set({
      worldmapId,
      center: { x: (meta?.totalWidth ?? 0) / 2, y: (meta?.totalHeight ?? 0) / 2 },
      scale: clampScale(worldmapId, meta?.startScale ?? 1),
      followPlayer: false,
      pickerOpen: false,
    })
  },
  togglePicker() {
    set({ pickerOpen: !state.pickerOpen })
  },
  centerOn(point: { x: number; y: number }, follow = false) {
    const center = clampCenter(state.worldmapId, point)
    // The HUD re-centres on every character snapshot while it follows the
    // player; emitting an identical state would re-render the whole HUD.
    if (center.x === state.center.x && center.y === state.center.y && follow === state.followPlayer) return
    set({ center, followPlayer: follow })
  },
  panBy(dx: number, dy: number) {
    set({
      center: clampCenter(state.worldmapId, {
        x: state.center.x + dx,
        y: state.center.y + dy,
      }),
      followPlayer: false,
    })
  },
  zoomBy(direction: 1 | -1) {
    const next = clampScale(
      state.worldmapId,
      direction > 0 ? state.scale * ZOOM_STEP : state.scale / ZOOM_STEP,
    )
    if (Math.abs(next - state.scale) < 1e-6) return
    set({ scale: next })
  },
  ensureVisibleScale(minimum: number) {
    const next = clampScale(state.worldmapId, minimum)
    if (next > state.scale + 1e-6) set({ scale: next })
  },
  toggleFilter(category: number) {
    const next = new Set(state.filters)
    if (next.has(category)) next.delete(category)
    else next.add(category)
    set({ filters: next })
  },
  setFilters(categories: Iterable<number>) {
    set({ filters: new Set(categories) })
  },
  addMarker(worldmapId: number, x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    const marker = { worldmapId, x: Math.floor(x), y: Math.floor(y) }
    if (state.markers.some(item => item.worldmapId === worldmapId && item.x === marker.x && item.y === marker.y)) return
    set({ markers: [...state.markers, marker], filters: new Set([...state.filters, 8]) })
  },
  clearMarkers() { set({ markers: [] }) },
  reset() {
    state = {
      markers: [],
      worldmapId: 0,
      center: { x: 0, y: 0 },
      scale: 1,
      filters: ALL_FILTERS,
      followPlayer: true,
      pickerOpen: false,
    }
    emit()
  },
}
