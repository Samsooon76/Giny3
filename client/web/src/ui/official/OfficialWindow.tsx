import { ModuleContextMenu, referenceModuleTitle } from './ModuleContextMenu'
import { moduleOptions, moduleOptionRows, moduleOptionSelected, activateModuleOption } from './moduleOptions'
/** The official window behaviour, applied by the renderer to every window.

    `MagneticDragWindow` and `WindowFigma` are the two chromes Ankama ships, and
    both are C# components: the UXML only stores their flags. This module reads
    those flags back (`windowChrome`), places the window from the layout store,
    and hands the renderer the drag surface, the resize grips and — when a
    `WindowFigma` tree still has no constructor `header` — a fallback title
    bar. Nothing here knows which window it is dealing with. */

import {
  Fragment, createContext, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
  type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref,
} from 'react'
import {
  windowStackStore, layoutStore, guideStore, measureStore, menuStore, prefsStore, updateAllWindows, type WindowLayout,
} from './layoutStore'
import {
  MAGNET_THRESHOLD, dockedEdges, resizeRect, snapMove, snapResize,
  type Bounds, type Edge, type Rect, type SizeQuantizer,
} from './magnetism'
import { OFFICIAL_CANVAS, surfaceScale } from './surface'
import { OfficialSprite } from './OfficialIcon'
import { ussToCss } from './uss'
import { HEADER_SMALL_PX, contextMenuUss, titleBarHeight } from './windowChromeStyles'
import { restoreFixedWindowSize, allowsWindowDrag, pendingContentMeasure, readWindowChrome, rectFromStyle, windowIntrinsicSize, type WindowChrome } from './windowChrome'
import { widgetMenu, widgetMenuState, type WidgetMenuEntry } from './widgetMenu'
import { tooltipStore } from './tooltipStore'
import type { VisualTreeNode } from './types'

/** Axes a window is still waiting to be measured on. */
export type PendingMeasure = { width: boolean; height: boolean }

export type WindowFrame = {
  chrome: WindowChrome
  layout: WindowLayout
  ref: Ref<HTMLElement>
  style: CSSProperties
  className: string
  handlers: {
    onPointerDownCapture?: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
  }
  /** Chrome the C# constructor draws and the UXML therefore does not carry. */
  before: ReactNode
  after: ReactNode
  /** Chrome that belongs inside the module's own official handle: the options
      button the constructor puts in `#header_right`. */
  handleChildren: ReactNode
  /** The handle's height, once the module's menu has reduced its title. */
  handleHeight?: number
}

export type WindowPlacement = 'canvas' | 'flow' | 'chrome'

export type WindowController = {
  bounds: Bounds
  layoutFor: (chrome: WindowChrome, node: VisualTreeNode) => WindowLayout
  pendingMeasure: (chrome: WindowChrome, node: VisualTreeNode) => PendingMeasure
  measure: (id: string, element: HTMLElement) => void
  register: (chrome: WindowChrome, layout: WindowLayout) => void
  unregister: (id: string) => void
  frameFor: (
    chrome: WindowChrome,
    layout: WindowLayout,
    pending: PendingMeasure,
    ref: Ref<HTMLElement>,
    menuOpen: boolean,
    placement?: WindowPlacement,
  ) => WindowFrame
}

export const WindowLayoutContext = createContext<WindowController | null>(null)
/** Nested WindowFigmas (craft storage, cartography quantity) stay in USS. */
/** Nested WindowFigmas sit in USS flow/chrome. `titleBar` tells the
    content pane to flex under an in-flow Figma header instead of filling
    `height: 100%` as if the bar still hung above the panel. */
export const InsideWindowContext = createContext<{
  nested: boolean
  titleBar: boolean
  /** Magnetic omit-default `#header_buttonRight` (`moreActions`). Figma close
      uses the same id and must not open this menu. */
  widgetMenuId?: string
}>({
  nested: false, titleBar: false,
})

const FLOW_LAYOUT: WindowLayout = { x: 0, y: 0, w: 0, h: 0, docked: [] }
const NO_PENDING: PendingMeasure = { width: false, height: false }
const NO_DRAG = {
  onPointerDown: () => undefined,
  onPointerMove: () => undefined,
  onPointerUp: () => undefined,
  onPointerCancel: () => undefined,
}

type Registration = { chrome: WindowChrome; layout: WindowLayout }
type Gesture = {
  id: string
  chrome: WindowChrome
  start: WindowLayout
  pointer: { x: number; y: number }
  edges?: Edge[]
}

/** Grips in the order the official window offers them, each tied to the flag
    that switches it on. */
const GRIPS: Array<{ key: string; edges: Edge[]; axis: 'horizontal' | 'vertical' | 'corner' }> = [
  { key: 'n', edges: ['n'], axis: 'vertical' },
  { key: 's', edges: ['s'], axis: 'vertical' },
  { key: 'e', edges: ['e'], axis: 'horizontal' },
  { key: 'w', edges: ['w'], axis: 'horizontal' },
  { key: 'ne', edges: ['n', 'e'], axis: 'corner' },
  { key: 'nw', edges: ['n', 'w'], axis: 'corner' },
  { key: 'se', edges: ['s', 'e'], axis: 'corner' },
  { key: 'sw', edges: ['s', 'w'], axis: 'corner' },
]

export function useWindowLayout(options: {
  bounds?: Bounds
  /** Optional safe-area above the canvas. GameHud does not pass one: the
      official HUD has no shellInset, and BannerMenu USS is `top: 55`. */
  insetTop?: number
  onClose?: (id: string) => void
  /** A window whose interior is a tile grid resizes in whole tiles; the host
      supplies that quantiser for gestures. Rest pose stays on the stylesheet. */
  quantizer?: (id: string) => SizeQuantizer | undefined
  /** Opening geometry for a window the official client places or sizes in
      code rather than in UXML. Whatever it leaves out stays as the USS says. */
  seed?: (id: string) => Partial<Rect> | undefined
}): WindowController {
  const bounds = options.bounds ?? OFFICIAL_CANVAS
  const insetTop = options.insetTop ?? 0
  const registry = useRef(new Map<string, Registration>())
  const gesture = useRef<Gesture | null>(null)
  const { onClose, quantizer, seed } = options

  const layoutFor = useCallback((chrome: WindowChrome, node: VisualTreeNode): WindowLayout => {
    const stored = layoutStore.get(chrome.id)
    if (stored) return restoreFixedWindowSize(chrome, stored)
    // A window whose stylesheet declares no size is sized by the host C#
    // client (stamped fallbackSize). Measuring the shrink-wrapped interior
    // would collapse spells to a 76px icon.
    const content = measureStore.snapshot()[chrome.id]
    const intrinsic = windowIntrinsicSize(chrome, content)
    const rect = {
      ...rectFromStyle(node.style, bounds, intrinsic, chrome.dragPosition, insetTop),
      ...seed?.(chrome.id),
    }
    // Keep the host seed (or authored rest pose) intact. Quantisers apply to
    // user resize gestures, not to the initial window placement.
    const placed: Rect = { ...rect, y: Math.max(insetTop, rect.y) }
    return { ...placed, docked: dockedEdges(placed, bounds) }
  }, [bounds, insetTop, seed])

  const pendingMeasure = useCallback((chrome: WindowChrome, node: VisualTreeNode): PendingMeasure => {
    if (layoutStore.get(chrome.id) || measureStore.snapshot()[chrome.id]) return { width: false, height: false }
    return pendingContentMeasure(chrome, node, seed?.(chrome.id) ?? {})
  }, [seed])

  const measure = useCallback((id: string, element: HTMLElement) => {
    const scale = surfaceScale(bounds, { width: innerWidth, height: innerHeight }) || 1
    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    measureStore.set(id, { w: Math.round(rect.width / scale), h: Math.round(rect.height / scale) })
  }, [bounds])

  const register = useCallback((chrome: WindowChrome, layout: WindowLayout) => {
    registry.current.set(chrome.id, { chrome, layout })
  }, [])
  const unregister = useCallback((id: string) => { registry.current.delete(id) }, [])

  /** Only the windows that declare `is-magnetic-for-others` attract another. */
  const targetsFor = useCallback((id: string) => {
    const targets: Array<{ id: string; rect: Rect }> = []
    for (const [key, entry] of registry.current) {
      if (key === id || !entry.chrome.magneticForOthers) continue
      targets.push({ id: key, rect: entry.layout })
    }
    return targets
  }, [])

  const commit = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const active = gesture.current
    if (!active) return
    const scale = surfaceScale(bounds, { width: innerWidth, height: innerHeight }) || 1
    const dx = (event.clientX - active.pointer.x) / scale
    const dy = (event.clientY - active.pointer.y) / scale
    const magnetic = active.chrome.magnetic || active.chrome.kind === 'figma'
    const settings = {
      bounds,
      targets: magnetic ? targetsFor(active.id) : [],
      offset: active.chrome.offset,
      // A window that opts out of magnetism still moves, it just never lands on
      // anything: a negative threshold rejects every candidate.
      threshold: magnetic ? MAGNET_THRESHOLD : -1,
      insetTop,
      quantize: quantizer?.(active.id),
    }
    const result = active.edges
      ? snapResize(resizeRect(active.start, active.edges, dx, dy), active.edges, settings)
      : snapMove({ ...active.start, x: active.start.x + dx, y: active.start.y + dy }, settings)
    const next: WindowLayout = { ...result.rect, docked: dockedEdges(result.rect, bounds), z: active.start.z }
    layoutStore.set(active.id, next)
    registry.current.set(active.id, { chrome: active.chrome, layout: next })
    guideStore.set(active.chrome.snapPreview && result.guides.length
      ? { owner: active.id, lines: result.guides }
      : { owner: '', lines: [] })
  }, [bounds, insetTop, quantizer, targetsFor])

  const endGesture = useCallback(() => {
    gesture.current = null
    guideStore.clear()
  }, [])

  const frameFor = useCallback((
    chrome: WindowChrome,
    layout: WindowLayout,
    pending: PendingMeasure,
    ref: Ref<HTMLElement>,
    menuOpen: boolean,
    placement: WindowPlacement = 'canvas',
  ): WindowFrame => {
    const skipCanvas = placement !== 'canvas'
    const locked = prefsStore.snapshot().locked
    const grips = skipCanvas || locked ? [] : GRIPS.filter((grip) => (
      grip.axis === 'corner' ? chrome.resize.corner
        : grip.axis === 'horizontal' ? chrome.resize.horizontal
          : chrome.resize.vertical
    ))
    const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
      const target = event.target as HTMLElement | null
      const grip = target?.closest<HTMLElement>('[data-window-grip]')
      const edges = grip?.dataset.windowGrip?.split('') as Edge[] | undefined
      if (!edges) {
        if (!allowsWindowDrag(chrome, target, locked)) return
      }
      event.preventDefault()
      tooltipStore.hide()
      const raised: WindowLayout = { ...layout, z: layoutStore.topZ() + 1 }
      layoutStore.set(chrome.id, raised)
      gesture.current = { id: chrome.id, chrome, start: raised, pointer: { x: event.clientX, y: event.clientY }, edges }
      // Capture keeps the gesture alive when the pointer outruns the window;
      // losing it is not a reason to lose the drag.
      try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* pointer already gone */ }
    }

    const treeHeader = chrome.handleName === 'header'
    // Widget kebab is `#header_buttonRight` in the tree (`moreActions`).
    // This overlay is only the `.contextMenu` popup; the 20px button lives
    // under USS `.header.widget .button#header_buttonRight`.
    const optionsMenu = chrome.kind === 'magnetic' && (chrome.rightIcon === 'moreActions' || referenceModuleTitle(chrome.id) != null || moduleOptionRows(chrome.id).length > 0) ? <WindowOptions
      chrome={chrome}
      layout={layout}
      open={menuOpen}
      locked={locked}
      variant="widget"
      windows={() => [...registry.current].map(([id, entry]) => ({ id, layout: entry.layout }))}
    /> : null
    const barHeight = titleBarHeight(chrome.headerStyle)
    const titleBar = chrome.titleBar && !treeHeader ? (
      <div
        key="giny-titlebar"
        className="official-window-titlebar official-drag-handle"
        data-drag-handle="true"
        style={{
          // MergedUSS `.header.primary` is `width: 100%; height: 42px` with
          // `border-radius: 12px 12px 0 0` — the panel's top edge, in flow.
          // Hanging at `top: -42` was a homemade overlay above the USS height.
          position: 'relative',
          left: 0,
          right: 0,
          top: 0,
          width: '100%',
          height: barHeight,
          flexShrink: 0,
          overflow: 'hidden',
          backgroundColor: 'var(--background_dark100, #1b1d32)',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
      >
        <div className={`header ${chrome.headerStyle} official-node`}>
          {chrome.ornament && (
            <>
              <div className="official-node" data-name="header_ornament_left" />
              <div className="official-node" data-name="header_ornament_right" />
            </>
          )}
          <div data-name="header_left">
            {chrome.icon && (
              <div data-name="header_icon">
                <div data-name="header_icon_asset">
                  <OfficialSprite name={chrome.icon} style={{ width: '100%', height: '100%' }} />
                </div>
              </div>
            )}
          </div>
          <div data-name="header_content">
            <div data-name="header_title">
              <span className="official-window-title" data-name="header_titleLabel">{chrome.title ?? ''}</span>
            </div>
          </div>
          <div data-name="header_right">
            {optionsMenu}
            {chrome.closeButton && <button
              type="button"
              className="window__close-button official-window-close"
              data-name="window__close-button"
              aria-label={chrome.title ? `Fermer ${chrome.title}` : 'Fermer la fenêtre'}
              onClick={(event) => { event.stopPropagation(); onClose?.(chrome.id) }}
            />}
          </div>
        </div>
      </div>
    ) : null

    return {
      chrome,
      layout,
      ref,
      handleChildren: chrome.handleName ? optionsMenu : null,
      handleHeight: layout.reducedHeader ? HEADER_SMALL_PX : chrome.handleHeight,
      className: [
        'official-window',
        !skipCanvas && chrome.movable && !locked && 'is-movable',
        grips.length && 'is-resizable',
        locked && 'is-locked',
        placement === 'flow' && 'is-flow',
        placement === 'chrome' && 'is-chrome',
      ].filter(Boolean).join(' '),
      // `flow`: clustered hosts (bank, auction) — UI Builder `absolute`
      // without insets is not Yoga flex; drop it.
      // `chrome`: nested overlays (cartography quantity) keep USS insets.
      style: placement === 'flow' ? {
        position: 'relative',
        left: 'auto', top: 'auto', right: 'auto', bottom: 'auto',
        marginLeft: 0, marginRight: 0,
        overflow: 'visible',
      } : placement === 'chrome' ? {
        overflow: 'visible',
      } : {
        position: 'absolute',
        left: layout.x, top: layout.y,
        width: pending.width ? 'auto' : layout.w,
        height: pending.height ? 'auto' : layout.h,
        right: 'auto', bottom: 'auto',
        zIndex: menuOpen ? 10000 : layout.z,
        overflow: 'visible',
      },
      handlers: skipCanvas ? NO_DRAG : {
        onPointerDownCapture: () => windowStackStore.raise(chrome.id),
        onPointerDown,
        onPointerMove: commit,
        onPointerUp: endGesture,
        onPointerCancel: endGesture,
      },
      before: <>{titleBar}{!chrome.handleName && optionsMenu}</>,
      after: grips.length ? <div key="giny-grips" className="official-window-grips">
        {grips.map((grip) => (
          <div key={grip.key} className={`official-window-grip is-${grip.key}`} data-window-grip={grip.edges.join('')} />
        ))}
      </div> : null,
    }
  }, [commit, endGesture, onClose])

  return useMemo(
    () => ({ bounds, layoutFor, pendingMeasure, measure, register, unregister, frameFor }),
    [bounds, layoutFor, pendingMeasure, measure, register, unregister, frameFor],
  )
}


/** The "more actions" button every official module carries, and the menu
    behind it.

    Every entry — its wording, its scope, its order — comes from `menus.json`,
    which the extractor builds from the client's own constants and I18n table.
    The only thing decided here is what an entry *does*, since that lives in
    compiled code: the ones this client can carry out are wired, and the ones
    that need per-module behaviour it does not have are shown the way the
    official sheet shows a disabled item, rather than omitted or faked. */
function WindowOptions({ chrome, layout, open, locked, windows }: {
  chrome: WindowChrome
  layout: WindowLayout
  open: boolean
  locked: boolean
  variant: 'primary' | 'secondary' | 'widget'
  windows: () => Array<{ id: string; layout: WindowLayout }>
  onClose?: () => void
}) {
  const menu = useMemo(() => contextMenuUss(), [])
  const slot = useRef<HTMLDivElement | null>(null)
  const popup = useRef<HTMLDivElement | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  useEffect(() => { widgetMenu.load() }, [])
  const entries = useSyncExternalStore(widgetMenu.subscribe, widgetMenu.snapshot, widgetMenu.snapshot)
  useSyncExternalStore(moduleOptions.subscribe, moduleOptions.snapshot)
  const preferences = moduleOptions.get(chrome.id)
  const customRows = moduleOptionRows(chrome.id)

  // A context menu closes on the next click anywhere else, or on Escape.
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (slot.current?.contains(event.target as Node)) return
      menuStore.close()
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') menuStore.close() }
    addEventListener('pointerdown', dismiss, true)
    addEventListener('keydown', escape)
    return () => {
      removeEventListener('pointerdown', dismiss, true)
      removeEventListener('keydown', escape)
    }
  }, [open])

  // A module can only reduce a title it actually has.
  const context = {
    titled: chrome.kind === 'magnetic' && chrome.handleName != null,
    reducedHeader: layout.reducedHeader === true,
    locked,
  }
  const state = (entry: WidgetMenuEntry) => widgetMenuState(entry.option, context)

  const apply = (entry: WidgetMenuEntry) => {
    const mine = (patch: Partial<WindowLayout>) => layoutStore.set(chrome.id, { ...layout, ...patch })
    const all = (patch: Partial<WindowLayout>) => updateAllWindows(windows(), patch)
    switch (entry.option) {
      case 'ReduceWidgetHeader': mine({ reducedHeader: true }); break
      case 'MaximizeWidgetHeader': mine({ reducedHeader: false }); break
      case 'HideWidget': mine({ hidden: true }); break
      case 'LockWidgetPosition': prefsStore.set({ locked: !locked }); break
      case 'ReduceAll': all({ reducedHeader: true }); break
      case 'MaximizeAll': all({ reducedHeader: false }); break
      case 'HideAllWidget': all({ hidden: true }); break
      case 'DisplayAllWidget': all({ hidden: false }); break
      default: return
    }
    menuStore.close()
  }

  const shown = entries.filter((entry) => state(entry).shown && state(entry).enabled)

  // A module near the bottom of the screen opens its menu upwards, so the last
  // entries stay reachable. The kebab itself is `#header_buttonRight` in the
  // tree; this overlay is only the popup, hung under the header.
  useLayoutEffect(() => {
    if (!open || !popup.current) { setFlipped(false); return }
    const box = popup.current.getBoundingClientRect()
    const anchor = slot.current?.getBoundingClientRect()
    if (referenceModuleTitle(chrome.id)) {
      const place = () => {
        if (!popup.current) return
        const rect = popup.current.getBoundingClientRect()
        const scale = rect.width / popup.current.offsetWidth || 1
        const canvas = popup.current.closest('.official-canvas')?.getBoundingClientRect()
        const bounds = { left: Math.max(0, canvas?.left ?? 0) + 8, top: Math.max(0, canvas?.top ?? 0) + 8, right: Math.min(innerWidth, canvas?.right ?? innerWidth) - 8, bottom: Math.min(innerHeight, canvas?.bottom ?? innerHeight) - 8 }
        setOffset(previous => {
          const left = rect.left - previous.x * scale
          const top = rect.top - previous.y * scale
          const next = { x: Math.max(bounds.left - left, Math.min(0, bounds.right - left - rect.width)) / scale, y: Math.max(bounds.top - top, Math.min(0, bounds.bottom - top - rect.height)) / scale }
          return Math.abs(next.x - previous.x) < .1 && Math.abs(next.y - previous.y) < .1 ? previous : next
        })
      }
      place()
      setFlipped(false)
      const observer = new ResizeObserver(place)
      observer.observe(popup.current)
      addEventListener('resize', place)
      return () => { observer.disconnect(); removeEventListener('resize', place) }
    }
    const overflows = box.bottom > innerHeight
    setFlipped(overflows && (anchor?.top ?? 0) - box.height > 0)
  }, [open, shown.length, layout.x, layout.y, layout.w, layout.h])

  if (!open || (shown.length === 0 && !referenceModuleTitle(chrome.id))) return null
  return <div
    ref={slot}
    className="official-window-options"
    style={{ position: 'absolute', right: 0, top: '100%', zIndex: 8 }}
  >
    <div
      ref={popup}
      className={`official-window-menu${referenceModuleTitle(chrome.id) ? ' module-reference-menu' : ''}${flipped ? ' is-flipped' : ''}`}
      style={referenceModuleTitle(chrome.id) ? { position: 'absolute', transform: `translate(${offset.x}px, ${offset.y}px)` } : ussToCss(menu.menu)}
      role="menu"
    >
      {referenceModuleTitle(chrome.id) ? <ModuleContextMenu id={chrome.id} layout={layout} titled={context.titled} /> : <>
      <div style={{padding:8,textAlign:'center',color:'#bbb',borderBottom:'1px solid #7775'}}>{chrome.id.toLowerCase().includes('characterinformation')?'Personnage':chrome.id.toLowerCase().includes('actionbar')?'Barre':chrome.id.toLowerCase().includes('progressgauge')?'Jauge':chrome.title || chrome.id}</div>
      {shown.map((entry, index) => {
        const { enabled, checked } = state(entry)
        return <Fragment key={entry.option}>
          {index > 0 && shown[index - 1].scope !== entry.scope && <div style={ussToCss(menu.separator)} />}
          <button
            type="button"
            role="menuitem"
            className="official-window-menu-item"
            style={ussToCss(menu.item)}
            disabled={!enabled}
            onClick={(event) => { event.stopPropagation(); apply(entry) }}
          >
            <span style={ussToCss(checked ? menu.statusChecked : menu.status)} />
            <span style={ussToCss(enabled ? menu.label : menu.labelDisabled)}>{entry.label}</span>
          </button>
        </Fragment>
      })}
      {customRows.map(row=><Fragment key={`${row.key}:${row.value}`}>
        {row.section && <div style={{padding:8,textAlign:'center',borderTop:'1px solid #7775'}}>{row.section}</div>}
        <button type="button" role="menuitemcheckbox" disabled={row.disabled} aria-checked={moduleOptionSelected(row,preferences)} className="official-window-menu-item" style={ussToCss(menu.item)} onClick={event=>{event.stopPropagation();if(row.key==='rows'){const delta=(40+Number(row.value)*48)-layout.h;layoutStore.set(chrome.id,{...layout,z:layoutStore.topZ()+1,h:layout.h+delta,y:Math.max(0,layout.y-delta)})}activateModuleOption(chrome.id,row)}}>
          <span style={{width:20}}>{moduleOptionSelected(row,preferences)?'✓':'○'}</span><span style={ussToCss(menu.label)}>{row.label}</span>
        </button>
      </Fragment>)}
      {chrome.id.toLowerCase().includes('progressgauge') && <label style={{display:'flex',gap:16,padding:8}}>Couleur de jauge <input type="color" aria-label="Couleur de jauge" value={preferences.gaugeColor} onChange={e=>moduleOptions.set(chrome.id,{gaugeColor:e.target.value})}/></label>}
      </>}
    </div>
  </div>
}

/** Give one window node its placement, then let the renderer carry on.

    Subscribing here rather than in `VisualNode` keeps a drag from re-rendering
    every node of every tree: only the window that moved reads the store. */
export function OfficialWindowNode({ node, controller, render, placement = 'canvas' }: {
  node: VisualTreeNode
  controller: WindowController
  render: (frame: WindowFrame) => ReactNode
  placement?: WindowPlacement
}) {
  const chrome = useMemo(() => readWindowChrome(node), [node])
  const id = chrome?.id ?? ''
  const snapshot = useSyncExternalStore(layoutStore.subscribe, () => layoutStore.snapshot()[id], () => layoutStore.snapshot()[id])
  const stack = useSyncExternalStore(windowStackStore.subscribe, () => windowStackStore.snapshot()[id] ?? 1, () => 1)
  const sizes = useSyncExternalStore(measureStore.subscribe, () => measureStore.snapshot()[id], () => measureStore.snapshot()[id])
  const openMenu = useSyncExternalStore(menuStore.subscribe, () => menuStore.snapshot() === id, () => false)
  // The shared lock affects every window; unrelated preferences do not.
  useSyncExternalStore(prefsStore.subscribe, () => prefsStore.snapshot().locked, () => prefsStore.snapshot().locked)
  const element = useRef<HTMLElement | null>(null)
  const { register, unregister, layoutFor, frameFor, pendingMeasure, measure } = controller
  const skipCanvas = placement !== 'canvas'
  const layout = useMemo(
    () => (chrome && !skipCanvas ? layoutFor(chrome, node) : null),
    [chrome, node, layoutFor, snapshot, sizes, skipCanvas],
  )
  const visibleId = !skipCanvas && chrome && layout && !layout.hidden ? chrome.id : null
  useLayoutEffect(() => {
    if (visibleId) windowStackStore.raise(visibleId)
  }, [visibleId])
  const pending = chrome && !skipCanvas ? pendingMeasure(chrome, node) : NO_PENDING
  // Measured before the browser paints, so the stand-in size is never seen.
  useLayoutEffect(() => {
    if (skipCanvas || !chrome || !element.current) return
    if (!pending.width && !pending.height) return
    measure(chrome.id, element.current)
  })
  useEffect(() => {
    if (skipCanvas || !chrome || !layout) return
    register(chrome, layout)
    return () => unregister(chrome.id)
  }, [chrome, skipCanvas, layout, register, unregister])
  if (!chrome) return null
  const inside = {
    nested: true,
    titleBar: chrome.titleBar,
    widgetMenuId: chrome.kind === 'magnetic' && (chrome.rightIcon === 'moreActions' || referenceModuleTitle(chrome.id) != null || moduleOptionRows(chrome.id).length > 0) ? chrome.id : undefined,
  }
  if (skipCanvas) {
    return <InsideWindowContext value={inside}>
      {render(frameFor(chrome, FLOW_LAYOUT, NO_PENDING, element, openMenu, placement))}
    </InsideWindowContext>
  }
  if (!layout) return null
  // `HideWidget`: gone until another module's menu brings them all back.
  if (layout.hidden) return null
  return <InsideWindowContext value={inside}>
    {render(frameFor(chrome, { ...layout, z: stack }, pending, element, openMenu, 'canvas'))}
  </InsideWindowContext>
}

/** The `allow-snap-preview` lines, drawn across the canvas while a window is
    still being dragged. */
export function SnapGuides({ bounds = OFFICIAL_CANVAS }: { bounds?: Bounds }) {
  const guides = useSyncExternalStore(guideStore.subscribe, guideStore.snapshot, guideStore.snapshot)
  if (!guides.lines.length) return null
  return <div className="official-snap-guides" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
    {guides.lines.map((guide, index) => (
      <div
        key={`${guide.axis}-${guide.at}-${index}`}
        className={`official-snap-guide is-${guide.axis}`}
        style={guide.axis === 'x'
          ? { position: 'absolute', left: guide.at, top: Math.max(0, guide.start), height: Math.min(bounds.height, guide.end) - Math.max(0, guide.start), width: 0 }
          : { position: 'absolute', top: guide.at, left: Math.max(0, guide.start), width: Math.min(bounds.width, guide.end) - Math.max(0, guide.start), height: 0 }}
      />
    ))}
  </div>
}
