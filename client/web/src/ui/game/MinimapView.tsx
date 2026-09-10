/** MINI-CARTE (`CartographyBannerUI`, `UiWidgetMinimap`).

    IL2CPP: `m_mapView` + `m_playerPos`, refreshed by `MapViewUpdate` on
    `OnCurrentMapLoaded` / `OnResize` / `OnGeometryChanged`. Its view type sits
    next to the big screen's — `CartographyService.CartographyBannerView` beside
    `CartographyService.CartographyMapView` — so both paint the same world map,
    and the official capture agrees: the widget shows the parchment cropped
    around the character with the hint pins on it, not the isometric cell grid
    of the map you stand on.

    Scale: measured off `output/ui_shots/official/hud.png`, where the widget is
    660 px wide over Incarnam (`mapWidth` 380) and spans five map cells — so the
    view fits `MINIMAP_MAPS_ACROSS` cells whatever the widget is resized to,
    which is what `MapViewUpdate` on `OnResize` recomputes. */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { MinimapContextMenu, type MinimapMenuAnchor } from './MinimapContextMenu'
import { worldmap } from './catalog'
import { mapCellCenter } from './worldmap'
import { worldmapViewStore } from './worldmapStore'
import { WorldMapView } from './WorldMapView'

/** Map cells across the widget, from the official capture (660 / 380 ≈ 5). */
export const MINIMAP_MAPS_ACROSS = 5

export type MinimapViewProps = {
  worldmapId: number
  /** Map coordinates of the character. */
  x: number
  y: number
  label?: string
}

export function MinimapView({ worldmapId, x, y, label }: MinimapViewProps) {
  const state = useSyncExternalStore(worldmapViewStore.subscribe, worldmapViewStore.snapshot)
  const [anchor, setAnchor] = useState<MinimapMenuAnchor | null>(null)
  const [center, setCenter] = useState<{ x: number; y: number } | undefined>()
  useEffect(() => setCenter(undefined), [worldmapId, x, y])
  const recenter = useCallback(() => setCenter(undefined), [])
  const close = useCallback(() => setAnchor(null), [])
  return (
    <div style={{ width: '100%', height: '100%' }} onClick={event => { if (event.altKey) { event.preventDefault(); event.stopPropagation(); recenter(); close() } }}>
    <WorldMapView
      worldmapId={worldmapId}
      player={{ x, y }}
      fitMaps={MINIMAP_MAPS_ACROSS}
      center={center}
      onPan={(dx, dy) => {
        const meta = worldmap(worldmapId)
        if (!meta) return
        setCenter(previous => {
          const point = previous ?? mapCellCenter(meta, x, y)
          return { x: Math.max(0, Math.min(meta.totalWidth ?? Infinity, point.x + dx)), y: Math.max(0, Math.min(meta.totalHeight ?? Infinity, point.y + dy)) }
        })
      }}
      filters={state.filters}
      onMapContextMenu={(event, point) => {
        event.preventDefault()
        event.stopPropagation()
        setAnchor({ x: event.clientX, y: event.clientY, mapX: point.x, mapY: point.y })
      }}
      showPins
      showPlayerPin
      label={label}
    />
    {anchor && <MinimapContextMenu anchor={anchor} worldmapId={worldmapId} onClose={close} onRecenter={recenter} />}
    </div>
  )
}
