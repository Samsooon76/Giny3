/** The official cartography parchment: `CartographyMapUI#mapView` and the
    `CartographyBannerUI#mapView` of the MINI-CARTE are the same picture.
    IL2CPP has one `CartographyService` with a `CartographyMapView` and a
    `CartographyBannerView` beside it, and the official capture confirms it: the
    widget shows the world map cropped around the character, not the tactical
    grid of the map you stand on.

    The picture is a zoom pyramid of 1024² tiles (`extractor.maps.export_worldmap`),
    so this paints only the tiles the viewport intersects, at the level closest
    above the requested scale. Pins are `hints.json` at native size — the
    official view does not scale them — and the current map is framed by
    `currenMapHighlight`, which does. */

import {
  useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore,
  type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent,
} from 'react'
import { hintCategory, uiString, worldmap } from './catalog'
import {
  groupWorldmapPins, mapCellCenter, mapToWorldmapPixel, worldmapHintIcon, worldmapLevelFor, worldmapPins, worldmapTiles,
  type WorldmapPin,
} from './worldmap'
import { worldmapViewStore } from './worldmapStore'
import { canvasRectFromDom } from '../official/surface'
import { officialUid, tooltipStore } from '../official/tooltipStore'
import './worldmap.css'

const CURRENT_MAP_FRAME = '/game-data/worldmaps/markers/currenMapHighlight.png'
const PLAYER_PIN = '/ui-data/icons/pin.png'

export type WorldMapPlayer = {
  /** Map coordinates, as the HUD reports them. */
  x: number
  y: number
}

export type WorldMapViewProps = {
  worldmapId: number
  player?: WorldMapPlayer
  /** World-map pixel under the middle of the viewport. Defaults to the player. */
  center?: { x: number; y: number }
  /** World-map pixels per CSS pixel. */
  scale?: number
  /** Instead of a scale, fit this many map cells across the viewport. */
  fitMaps?: number
  /** Hint categories to paint; every category when omitted. */
  filters?: ReadonlySet<number>
  showPins?: boolean
  /** `currenMapHighlight` + the `[x,y]` pill over the player's map. */
  showCurrentMap?: boolean
  /** The blue `pin` glyph the MINI-CARTE puts on the character. */
  showPlayerPin?: boolean
  /** Drag to pan, wheel to zoom, through `worldmapViewStore`. */
  interactive?: boolean
  label?: string
  onPan?: (dx: number, dy: number) => void
  onMapContextMenu?: (event: React.MouseEvent<HTMLDivElement>, point: WorldMapPlayer) => void
}

/** Size of the host **in its own layout units**, not in screen pixels.

    The official HUD lives on a 1920×1080 surface that is CSS-transformed to fit
    the window, so `getBoundingClientRect()` returns the scaled-down box: on an
    800 px window a 852-unit widget measures 355. Feeding that back into a
    transform *inside* the same surface scales it twice and the parchment covers
    less than half the widget. `contentRect` (and `offsetWidth` for the first
    paint) are the untransformed numbers. */
function useViewportSize(): [React.RefObject<HTMLDivElement | null>, { width: number; height: number }] {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const host = ref.current
    if (!host) return
    const apply = (width: number, height: number) => setSize((current) => (
      Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
        ? current
        : { width, height }
    ))
    apply(host.offsetWidth, host.offsetHeight)
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect
      if (box) apply(box.width, box.height)
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])
  return [ref, size]
}

export function WorldMapView({
  worldmapId, player, center, scale, fitMaps, filters,
  showPins = true, showCurrentMap = false, showPlayerPin = false,
  interactive = false, label, onMapContextMenu, onPan,
}: WorldMapViewProps) {
  const mapState = useSyncExternalStore(worldmapViewStore.subscribe, worldmapViewStore.snapshot)
  const [host, size] = useViewportSize()
  const [panning, setPanning] = useState(false)
  const moved = useRef(false)
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const meta = worldmap(worldmapId)

  // Two anchors: the cell's corner frames it, its middle is what the view
  // centres on and where the "you are here" marker sits. None of the three
  // values below is memoised: they all read the catalogue, which hydrates
  // after the first paint, so a dependency list over the props alone would
  // freeze whatever they computed before the fetch landed.
  const playerCell = meta && player ? mapToWorldmapPixel(meta, player.x, player.y) : undefined
  const playerPixel = meta && player ? mapCellCenter(meta, player.x, player.y) : undefined

  const requestedScale = fitMaps && size.width > 0 && meta?.mapWidth
    ? size.width / (fitMaps * meta.mapWidth)
    : scale ?? 1

  const effectiveScale = interactive && meta ? Math.max(requestedScale, size.width / (meta.totalWidth ?? 1), size.height / (meta.totalHeight ?? 1)) : requestedScale
  useEffect(() => {
    if (interactive && meta && worldmapViewStore.snapshot().worldmapId === worldmapId) worldmapViewStore.ensureVisibleScale(effectiveScale)
  }, [interactive, meta, worldmapId, effectiveScale])
  const requestedCenter = center ?? playerPixel ?? {
    x: (meta?.totalWidth ?? 0) / 2,
    y: (meta?.totalHeight ?? 0) / 2,
  }

  const halfWidth = size.width / (2 * effectiveScale), halfHeight = size.height / (2 * effectiveScale)
  const viewCenter = interactive && meta ? {
    x: Math.max(halfWidth, Math.min((meta.totalWidth ?? 1) - halfWidth, requestedCenter.x)),
    y: Math.max(halfHeight, Math.min((meta.totalHeight ?? 1) - halfHeight, requestedCenter.y)),
  } : requestedCenter
  const level = worldmapLevelFor(worldmapId, effectiveScale)

  const tiles = level && size.width > 0 && size.height > 0
    ? worldmapTiles(worldmapId, level, {
        x: (viewCenter.x - size.width / (2 * effectiveScale)) * level.zoom,
        y: (viewCenter.y - size.height / (2 * effectiveScale)) * level.zoom,
        width: (size.width / effectiveScale) * level.zoom,
        height: (size.height / effectiveScale) * level.zoom,
      })
    : []

  // Not memoised on purpose: the pins come out of the catalogue, which
  // hydrates after the first paint, and a `useMemo` keyed on the props alone
  // would keep the empty list it built before the fetch landed.
  const pins = showPins ? worldmapPins(worldmapId, filters) : []

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if ((!interactive && !onPan) || event.button !== 0 || event.altKey) return
    moved.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    setPanning(true)
  }, [interactive, onPan])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    drag.current = { ...current, x: event.clientX, y: event.clientY }
    const surfaceScale = event.currentTarget.getBoundingClientRect().width / event.currentTarget.clientWidth || 1
    if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true
    const pan = onPan ?? worldmapViewStore.panBy
    pan(-dx / (effectiveScale * surfaceScale), -dy / (effectiveScale * surfaceScale))
  }, [effectiveScale, onPan])

  const endPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    setPanning(false)
  }, [])

  const onWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (!interactive) return
    worldmapViewStore.zoomBy(event.deltaY < 0 ? 1 : -1)
  }, [interactive])

  // `Alt + clic` is the official shortcut behind `ui.cartography.centerOnPlayer`.
  const onClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (moved.current) { moved.current = false; event.preventDefault(); event.stopPropagation(); return }
    if (!interactive || !event.altKey || !playerPixel) return
    worldmapViewStore.centerOn(playerPixel, true)
  }, [interactive, playerPixel])

  const toScreenX = (x: number) => size.width / 2 + (x - viewCenter.x) * effectiveScale
  const toScreenY = (y: number) => size.height / 2 + (y - viewCenter.y) * effectiveScale

  const caption = label ?? meta?.name
  const layerScale = level ? effectiveScale / level.zoom : 1

  return (
    <div
      ref={host}
      className={`giny-worldmap${interactive ? ' is-interactive' : ''}${panning ? ' is-panning' : ''}`}
      role="img"
      aria-label={caption}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onWheel={onWheel}
      onClick={onClick}
      onContextMenu={event => {
        if (!onMapContextMenu || !meta?.mapWidth || !meta.mapHeight) return
        const rect = event.currentTarget.getBoundingClientRect()
        const px = viewCenter.x + ((event.clientX - rect.left) / rect.width - 0.5) * size.width / effectiveScale
        const py = viewCenter.y + ((event.clientY - rect.top) / rect.height - 0.5) * size.height / effectiveScale
        onMapContextMenu(event, { x: Math.floor((px - (meta.origineX ?? 0)) / meta.mapWidth), y: Math.floor((py - (meta.origineY ?? 0)) / meta.mapHeight) })
      }}
    >
      {level && (
        <div
          className="giny-worldmap__sheet"
          style={{
            width: level.width,
            height: level.height,
            transform: `translate(${size.width / 2 - viewCenter.x * effectiveScale}px, ${size.height / 2 - viewCenter.y * effectiveScale}px) scale(${layerScale})`,
          }}
        >
          {tiles.map((tile) => (
            <img
              key={tile.key}
              className="giny-worldmap__tile"
              src={tile.url}
              alt=""
              draggable={false}
              style={{
                left: tile.left,
                top: tile.top,
                width: tile.left + tile.width >= level.width ? tile.width : tile.width + 1,
                height: tile.top + tile.height >= level.height ? tile.height : tile.height + 1,
              }}
            />
          ))}
        </div>
      )}

      <div className="giny-worldmap__overlay">
        {groupWorldmapPins(pins).map((group) => (
          <HintPinGroup
            key={`${worldmapId}:${group.map((pin) => pin.id).join(':')}`}
            pins={group}
            x={toScreenX(group[0].pixelX)}
            y={toScreenY(group[0].pixelY)}
            cellWidth={(meta?.mapWidth ?? 0) * effectiveScale}
            cellHeight={(meta?.mapHeight ?? 0) * effectiveScale}
          />
        ))}

        {showCurrentMap && playerPixel && meta && (
          <>
            <img
              className="giny-worldmap__here"
              src={CURRENT_MAP_FRAME}
              alt=""
              draggable={false}
              style={{
                left: toScreenX(playerCell?.x ?? playerPixel.x),
                top: toScreenY(playerCell?.y ?? playerPixel.y),
                width: (meta.mapWidth ?? 0) * effectiveScale,
                height: (meta.mapHeight ?? 0) * effectiveScale,
              }}
            />
            <span
              className="giny-worldmap__coords"
              style={{
                left: toScreenX(playerPixel.x),
                top: toScreenY(playerPixel.y) + ((meta.mapHeight ?? 0) * effectiveScale) / 2,
              }}
            >
              {`[${player?.x ?? 0},${player?.y ?? 0}]`}
            </span>
          </>
        )}

        {meta && (filters ?? mapState.filters).has(8) && mapState.markers.filter(marker => marker.worldmapId === worldmapId).map(marker => {
          const point = mapCellCenter(meta, marker.x, marker.y)
          return <span key={`${marker.x}:${marker.y}`} className="giny-worldmap__player" title={`Repère [${marker.x},${marker.y}]`}
            style={{ left: toScreenX(point.x), top: toScreenY(point.y), backgroundColor: '#efff4f', maskImage: `url(${PLAYER_PIN})`, WebkitMaskImage: `url(${PLAYER_PIN})` }} />
        })}
        {showPlayerPin && playerPixel && (
          <span
            className="giny-worldmap__player"
            title={uiString('ui.cartography.yourposition')}
            style={{
              left: toScreenX(playerPixel.x),
              top: toScreenY(playerPixel.y),
              maskImage: `url(${PLAYER_PIN})`,
              WebkitMaskImage: `url(${PLAYER_PIN})`,
            }}
          />
        )}
      </div>

      {!level && <span className="giny-worldmap__empty">{caption ?? ''}</span>}
    </div>
  )
}

/** A stack opens for the whole map cell, so crossing between icons keeps it open. */
function HintPinGroup({ pins, x, y, cellWidth, cellHeight }: {
  pins: WorldmapPin[]; x: number; y: number; cellWidth: number; cellHeight: number
}) {
  const [expanded, setExpanded] = useState(false)
  const multiple = pins.length > 1
  const radius = multiple ? Math.max(26, 20 / Math.sin(Math.PI / pins.length)) : 0
  const width = Math.max(cellWidth, expanded ? radius * 2 + 36 : 36)
  const height = Math.max(cellHeight, expanded ? radius * 2 + 36 : 36)
  return (
    <div
      className={`giny-worldmap__pin-group${expanded && multiple ? ' is-expanded' : ''}`}
      style={{ left: x, top: y, width: multiple ? width : 36, height: multiple ? height : 36 }}
      onPointerEnter={multiple ? () => setExpanded(true) : undefined}
      onPointerLeave={() => setExpanded(false)}
    >
      {multiple && expanded && (
        <img className="giny-worldmap__group-frame" src={CURRENT_MAP_FRAME} alt="" draggable={false}
          style={{ width: cellWidth, height: cellHeight }} />
      )}
      {pins.map((pin, index) => {
        const angle = -Math.PI / 2 + index * Math.PI * 2 / pins.length
        const stackOffset = multiple ? (Math.min(index, 2) - Math.min(pins.length - 1, 2)) * 3 : 0
        return <HintPin key={pin.id} gfx={pin.gfx} name={pin.name} id={pin.id} category={pin.categoryId}
          x={(multiple ? width : 36) / 2 + (multiple && expanded ? Math.cos(angle) * radius : stackOffset)}
          y={(multiple ? height : 36) / 2 + (multiple && expanded ? Math.sin(angle) * radius : stackOffset)}
          showTooltip={!multiple || expanded} />
      })}
      {multiple && !expanded && <span className="giny-worldmap__pin-count">{pins.length}</span>}
    </div>
  )
}

/** One `hints.json` pin. The official view names it on hover; the caption is
    the hint's own `nameId`, with its category as the fallback. */
function HintPin({ gfx, name, category, x, y, id, showTooltip = true }: {
  gfx: number
  name?: string
  category: number
  x: number
  y: number
  id: number
  showTooltip?: boolean
}) {
  const uid = officialUid('CartographyMapUI', 'hint', id, 'tx_hint')
  const [broken, setBroken] = useState(false)
  useEffect(() => () => tooltipStore.hide(uid), [uid])
  useEffect(() => { if (!showTooltip) tooltipStore.hide(uid) }, [showTooltip, uid])
  if (broken) return null
  const caption = showTooltip ? name ?? hintCategory(category)?.name : undefined
  return (
    <img
      className="giny-worldmap__pin"
      src={worldmapHintIcon(gfx)}
      alt=""
      draggable={false}
      style={{ left: x, top: y, width: 36, height: 36, objectFit: 'contain' }}
      onError={() => setBroken(true)}
      onPointerEnter={caption ? (event) => tooltipStore.show({
        source: uid,
        tree: 'TextTooltip',
        text: caption,
        rect: canvasRectFromDom(event.currentTarget),
      }) : undefined}
      onPointerLeave={caption ? () => tooltipStore.hide(uid) : undefined}
    />
  )
}
