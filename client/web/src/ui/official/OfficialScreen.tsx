import { windowStackStore } from './layoutStore'
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { SnapGuides, WindowLayoutContext, useWindowLayout } from './OfficialWindow'
import { OFFICIAL_CANVAS, canvasRectFromDom, surfaceScale } from './surface'
import { cssText, uiUrl } from './uss'
import { withWindowFrame } from './windowFrame'
import type { BindingResolver, OfficialTreeName, VisualTreeNode } from './types'
import { EMPTY_REPEATER, repeaterTemplateNames, type Repeater } from './repeaters'
import {
  placeTooltip, tooltipResolve, tooltipStore, type TooltipRequest,
} from './tooltipStore'
import { ComponentStyleContext, OfficialTreeContext, VisualNode } from './visualNode'
import { useComponentStyles, useOfficialTree, useViewport } from './treeLoader'
import { treeFrameOffset } from './treeFrame'
import { applyUitkEffects, hasUitkSheet, isInlineUitkTemplate, UitkHostContext, UitkPaintContext, uitkSheetNames } from './uitk'
import './official.css'

export type { OfficialTreeName } from './types'

type Props = {
  tree: OfficialTreeName
  resolve?: BindingResolver
  background?: string
  repeaters?: Repeater
}

export function OfficialScreen({ tree, resolve = () => undefined, background, repeaters = EMPTY_REPEATER }: Props) {
  const payload = useOfficialTree(tree, repeaterTemplateNames(repeaters))
  const viewport = useViewport()
  const styles = useComponentStyles()
  if (!payload) return <div className="official-loading">Chargement de l’interface officielle…</div>
  const declaredCanvas = payload.screen.canvas
  if (import.meta.env.DEV && tree !== 'login' && declaredCanvas &&
      (declaredCanvas.width !== OFFICIAL_CANVAS.width || declaredCanvas.height !== OFFICIAL_CANVAS.height)) {
    console.debug(`[OfficialScreen] ${tree} intentionally ignores the authoring canvas dimensions`, declaredCanvas)
  }
  const canvas = OFFICIAL_CANVAS
  return <ScaledSurface canvas={canvas} viewport={viewport} className={`official-stage official-stage--${tree}`} uitkCanvas>
    <OfficialFonts />
    <UitkTreeSheet tree={tree} extras={repeaterTemplateNames(repeaters)} />
    {background && <div className="official-background" style={{ backgroundImage: `url("${uiUrl(background)}")` }} />}
    <ComponentStyleContext value={styles}>
      <TreeFrame tree={tree} node={payload.screen} canvas={canvas} resolve={resolve} repeaters={repeaters} templates={payload.templates} keepPaint />
      <TooltipLayer canvas={canvas} />
    </ComponentStyleContext>
  </ScaledSurface>
}

export function OfficialOverlay({ tree, resolve = () => undefined, modal = false }: { tree: OfficialTreeName; resolve?: BindingResolver; modal?: boolean }) {
  const payload = useOfficialTree(tree)
  const viewport = useViewport()
  const styles = useComponentStyles()
  if (!payload) return null
  const canvas = OFFICIAL_CANVAS
  return <ScaledSurface canvas={canvas} viewport={viewport} className={`official-overlay official-overlay--${tree} ${modal ? 'is-modal' : ''}`}>
    <ComponentStyleContext value={styles}>
      <TreeFrame tree={tree} node={payload.screen} canvas={canvas} resolve={resolve} repeaters={EMPTY_REPEATER} templates={payload.templates} pinOrigin />
    </ComponentStyleContext>
  </ScaledSurface>
}

function ScaledSurface({ canvas, viewport, className, children, uitkCanvas = false }: { canvas: { width: number; height: number }; viewport: { width: number; height: number }; className: string; children: ReactNode; uitkCanvas?: boolean }) {
  const scale = surfaceScale(canvas, viewport)
  const available = uitkCanvas
  const [sheetReady, setSheetReady] = useState(false)
  const uitk = available && sheetReady
  const canvasRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!available) setSheetReady(false)
  }, [available])
  useEffect(() => {
    if (!uitk || !canvasRef.current) return
    const root = canvasRef.current
    let frame = 0
    const paint = () => {
      clearTimeout(frame)
      frame = window.setTimeout(() => applyUitkEffects(root), 0)
    }
    paint()
    const observer = new MutationObserver(paint)
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
    return () => { observer.disconnect(); clearTimeout(frame) }
  }, [uitk])
  return <UitkHostContext value={uitkCanvas}>
    <UitkPaintContext value={uitk}>
      {available ? <link rel="stylesheet" href="/uitk/theme.css" onLoad={() => setSheetReady(true)} onError={() => setSheetReady(false)} /> : null}
      <div className={className}>
        <div className="official-wrap" style={{ width: canvas.width * scale, height: canvas.height * scale }}>
          <div ref={canvasRef} data-canvas-width={canvas.width} className={`official-canvas${uitk ? ' uitk-root uitk-panel' : ''}`} style={{ width: canvas.width, height: canvas.height, transform: `scale(${scale})` }}>{children}</div>
        </div>
      </div>
    </UitkPaintContext>
  </UitkHostContext>
}

/** How a tree's UXML document root behaves once mounted on the canvas.

    The root is only a wrapper: it carries the editor-canvas offset and ships
    hidden. Neutralising it turns the tree into a transparent layer over the
    official runtime surface, and whatever window sits inside then places
    itself from the layout store — the same for a HUD widget and for an
    interface the player opens. */
const TREE_ROOT_STYLE: CSSProperties = {
  position: 'absolute', left: 0, top: 0, right: 'auto', bottom: 'auto',
  width: '100%', height: '100%', overflow: 'visible', display: 'flex',
}

/** A tree the client has to frame itself, because its UXML carries no official
    window. */
export type TreeFrameRequest = { id: string; title?: string; icon?: string; shortcut?: string; size: { width: number; height: number } }

export function OfficialTree({ tree, resolve = () => undefined, rootStyle = TREE_ROOT_STYLE, frame, fallback, repeaters = EMPTY_REPEATER, keepPaint }: {
  tree: OfficialTreeName
  resolve?: BindingResolver
  rootStyle?: CSSProperties
  frame?: TreeFrameRequest
  fallback?: ReactNode
  repeaters?: Repeater
  /** Keep the compiled JSON sprite/9-slice paint under the UITK theme.
      Tooltips use this: some of them (`ChatTooltip`) have no generated
      `/uitk/trees/{tree}.css`, so dropping JSON paint leaves their bubble
      transparent — black official text floating over the dark game. Trees
      with a sheet keep identical values inline (sheet rules are `:where()`,
      specificity 0, so inline wins ties without changing them). */
  keepPaint?: boolean
}) {
  const inheritedPaint = useContext(UitkPaintContext)
  // These documents currently have compiled UXML/USS JSON but no generated
  // UITK sheet. Preserve the complete parsed styles (including typography),
  // rather than stripping them in favour of a stylesheet that does not exist.
  const useJsonStyles = !hasUitkSheet(tree)
  const payload = useOfficialTree(tree, [...new Set([...repeaterTemplateNames(repeaters), ...uitkSheetNames(tree)])])
  const styles = useComponentStyles()
  useLayoutEffect(() => {
    if (payload && tree === 'CartographyMapUI' && frame) windowStackStore.raise(frame.id)
  }, [payload, tree, frame?.id])
  const screen = useMemo(
    () => (payload ? (frame ? withWindowFrame(payload.screen, frame) : payload.screen) : null),
    [payload, frame],
  )
  if (!payload || !screen) return fallback !== undefined ? fallback : <div className="official-loading">Chargement…</div>
  return <div className="official-tree-host" data-tree={tree}>
    <UitkTreeSheet tree={tree} extras={repeaterTemplateNames(repeaters)} />
    <OfficialFonts />
    <UitkPaintContext value={useJsonStyles ? false : inheritedPaint}><ComponentStyleContext value={styles}>
      <OfficialTreeContext value={tree}>
        <VisualNode node={screen} resolve={resolve} repeaters={repeaters} templates={payload.templates} rootStyle={rootStyle} keepPaint={keepPaint} />
      </OfficialTreeContext>
    </ComponentStyleContext></UitkPaintContext>
  </div>
}

/** The in-game HUD: every widget tree stacked on one runtime surface.

    Each widget carries its own absolute position in that space — the action bar
    sits at 636/990, the quest tracker at 1/181 — so the layout comes from the
    official stylesheets, and from the layout store once the player has moved
    something. A host never places a tree: it seeds a window's rectangle
    through the controller, which is where the two coordinates the C# client
    owns rather than the UXML belong. */
export function OfficialHud({ layers, windows = [], chrome = [], canvas = OFFICIAL_CANVAS }: {
  canvas?: { width: number; height: number }
  layers: Array<{ tree: OfficialTreeName; resolve?: BindingResolver; repeaters?: Repeater }>
  /** Interfaces the player opened. They share the widgets' canvas so a window
      and a widget can attract one another. */
  windows?: Array<{ key: string; tree: OfficialTreeName; resolve?: BindingResolver; repeaters?: Repeater; frame: TreeFrameRequest }>
  /** Documents that stay above those windows (`gameMenu`). */
  chrome?: Array<{ tree: OfficialTreeName; resolve?: BindingResolver; repeaters?: Repeater }>
}) {
  const viewport = useViewport()
  return <ScaledSurface canvas={canvas} viewport={viewport} className="official-hud" uitkCanvas>
    <OfficialFonts />
    {layers.map(({ tree, resolve, repeaters }) => (
      <div className="official-hud-layer" key={tree}>
        <OfficialTree tree={tree} resolve={resolve} repeaters={repeaters} />
      </div>
    ))}
    {windows.map(({ key, tree, resolve, frame, repeaters }) => (
      tree === 'CartographyMapUI' ? <ScreenWindowLayer key={key} id={key}>
        <OfficialTree tree={tree} resolve={resolve} frame={frame} repeaters={repeaters} />
      </ScreenWindowLayer> : <div className="official-hud-layer official-hud-window" key={key}>
        <OfficialTree tree={tree} resolve={resolve} frame={frame} repeaters={repeaters} />
      </div>
    ))}
    {chrome.map(({ tree, resolve, repeaters }) => (
      <div className="official-hud-layer official-hud-chrome" key={tree}>
        <OfficialTree tree={tree} resolve={resolve} repeaters={repeaters} />
      </div>
    ))}
    <SnapGuides bounds={canvas} />
    <TooltipLayer canvas={canvas} />
  </ScaledSurface>
}

/** Screen documents without a movable frame still participate in window stacking. */
function ScreenWindowLayer({ id, children }: { id: string; children: ReactNode }) {
  const z = useSyncExternalStore(windowStackStore.subscribe, () => windowStackStore.snapshot()[id] ?? 1, () => 1)
  return <div className="official-hud-layer official-hud-window" style={{ zIndex: z }} onPointerDownCapture={() => windowStackStore.raise(id)}>{children}</div>
}

/** An isolated extracted interface, using the very same parser as the HUD.
 * Only the workshop viewport changes; the tree still owns every layout. */
export function OfficialInterfacePreview({ tree, frame, resolve, repeaters, onClose }: {
  tree: OfficialTreeName
  frame: TreeFrameRequest
  resolve: BindingResolver
  repeaters?: Repeater
  onClose?: () => void
}) {
  const canvas = useMemo(() => ({ width: frame.size.width + 48, height: frame.size.height + 48 }), [frame.size.width, frame.size.height])
  const controller = useWindowLayout({ bounds: canvas, onClose, seed: () => ({ x: 24, y: 24 }) })
  return <WindowLayoutContext value={controller}>
    <OfficialHud canvas={canvas} layers={[]} windows={[{ key: frame.id, tree, frame, resolve, repeaters }]} />
  </WindowLayoutContext>
}

function TooltipLayer({ canvas }: { canvas: { width: number; height: number } }) {
  const shown = useSyncExternalStore(tooltipStore.subscribe, tooltipStore.snapshot, tooltipStore.snapshot)
  useEffect(() => {
    const dismiss = () => tooltipStore.hide()
    addEventListener('scroll', dismiss, true)
    return () => removeEventListener('scroll', dismiss, true)
  }, [])
  if (!shown) return null
  return <TooltipPaint key={`${shown.source}:${shown.tree}`} request={shown} canvas={canvas} />
}

function TooltipPaint({ request, canvas }: { request: TooltipRequest; canvas: { width: number; height: number } }) {
  const host = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const root = host.current
    if (!root) return
    const ro = new ResizeObserver((entries) => {
      const node = entries[0]?.target
      if (!(node instanceof HTMLElement)) return
      const rect = canvasRectFromDom(node)
      if (rect.w <= 1 || rect.h <= 1) return
      setSize((current) => (current.w === rect.w && current.h === rect.h ? current : { w: rect.w, h: rect.h }))
    })
    let observed: HTMLElement | null = null
    const attach = () => {
      const node = host.current?.querySelector<HTMLElement>(
        '[data-binding="textTooltip"], [data-binding="itemTooltip"], [data-binding="spellTooltip"], [data-binding="background"], [data-official-id]',
      )
      if (!node || node === observed) return
      if (observed) ro.unobserve(observed)
      observed = node
      ro.observe(node)
    }
    const mo = new MutationObserver(attach)
    mo.observe(root, { childList: true, subtree: true })
    attach()
    return () => { mo.disconnect(); ro.disconnect() }
  }, [])

  const pos = request.placement === 'above-center'
    ? { left: Math.max(0, Math.min(canvas.width-size.w, request.rect.x-size.w/2)), top: Math.max(0, Math.min(canvas.height-size.h, request.rect.y-size.h-20)) }
    : placeTooltip(request.rect, size, canvas)
  return <div
    ref={host}
    className="official-hud-tooltips"
    style={{ visibility: size.w > 0 ? 'visible' : 'hidden' }}
  >
    <OfficialTree
      tree={request.tree}
      resolve={tooltipResolve(request)}
      repeaters={request.repeaters ?? EMPTY_REPEATER}
      fallback={null}
      keepPaint
      rootStyle={{
        position: 'absolute',
        left: pos.left,
        top: pos.top,
        width: 'auto',
        height: 'auto',
        right: 'auto',
        bottom: 'auto',
        overflow: 'visible',
      }}
    />
  </div>
}

function TreeFrame({ tree, node, canvas, resolve, repeaters, templates, pinOrigin = false, keepPaint = false }: {
  tree: string
  node: VisualTreeNode
  canvas: { width: number; height: number }
  resolve: BindingResolver
  repeaters: Repeater
  templates: Record<string, VisualTreeNode>
  pinOrigin?: boolean
  keepPaint?: boolean
}) {
  const source = node.canvas ?? canvas
  const offset = treeFrameOffset(canvas, source, pinOrigin)
  return <OfficialTreeContext value={tree}>
    <div className="official-tree-frame" style={{
      width: source.width, height: source.height,
      left: offset.left, top: offset.top,
    }}>
      <VisualNode node={node} resolve={resolve} repeaters={repeaters} templates={templates} keepPaint={keepPaint} />
    </div>
  </OfficialTreeContext>
}

function UitkTreeSheet({ tree, extras = [] }: { tree: string; extras?: string[] }) {
  const host = useContext(UitkHostContext)
  if (!host) return null
  const sheets = [...new Set([...uitkSheetNames(tree), ...extras.map(name => name.split('#')[0])])].filter(
    (name) => name !== tree && !isInlineUitkTemplate(name) && hasUitkSheet(name),
  )
  return <>
    {hasUitkSheet(tree) && <link rel="stylesheet" href={`/uitk/trees/${tree}.css`} />}
    {sheets.map((name) => <link key={name} rel="stylesheet" href={`/uitk/trees/${name}.css`} />)}
  </>
}

/** Declare one @font-face per font the extractor pulled out of the bundles.

    Node styles reference families by file stem, so without this every element
    silently falls back to the CSS default and the metrics drift. */
function OfficialFonts() {
  const uitkHost = useContext(UitkHostContext)
  const [faces, setFaces] = useState('')
  const [theme, setTheme] = useState('')
  const [base, setBase] = useState('')
  const [palette, setPalette] = useState('')
  useEffect(() => {
    let active = true
    fetch('/ui-data/manifest.json')
      .then((response) => (response.ok ? response.json() : null))
      .then((manifest: { fonts?: Record<string, string>; root_style?: Record<string, unknown> } | null) => {
        if (!active || !manifest) return
        // The official document declares its inherited base on `:root`
        // (font-size 14px, colour, font). Falling back to the browser default
        // gave every element that sets no size of its own 16px instead of 14,
        // which is a 14% error on every label and on every width measured from
        // one. The HUD canvas uses dofus3-ui tokens instead of this compiled
        // DarkStone root (near-black text on dark panels).
        if (!uitkHost && manifest.root_style) {
          const declarations = cssText(manifest.root_style)
          if (declarations) setBase(`.official-canvas,.official-tree-host{${declarations}}`)
        }
        if (!manifest.fonts) return
        // `swap`, not `block`: a blocking face leaves every extracted label
        // invisible for up to three seconds on a cold load.
        const declared = new Set<string>()
        const rules: string[] = []
        for (const file of Object.values(manifest.fonts)) {
          const family = file.replace(/\.(ttf|otf)$/i, '')
          if (declared.has(family)) continue
          declared.add(family)
          const format = /\.otf$/i.test(file) ? 'opentype' : 'truetype'
          rules.push(`@font-face{font-family:"${family}";src:url("/ui-data/fonts/${file}") format("${format}");font-display:swap}`)
        }
        setFaces(rules.join(''))
      })
      .catch(() => undefined)
    if (uitkHost) return () => { active = false }
    // darkStone/colors.json only carries the highlight_* ramp. The rest of the
    // palette (white_*, black_*, …) lives in tokens.json as theme variable
    // declarations per selector; without the `:root` entries every USS rule
    // referencing `var(--white_white100)` resolves to nothing and inherits the
    // compiled DarkStone root colour — near-black text on dark panels.
    fetch('/ui-data/tokens.json')
      .then((response) => (response.ok ? response.json() : null))
      .then((tokens: Record<string, Array<{ selector?: string; classes?: string[]; value: string }>> | null) => {
        if (!active || !tokens) return
        const vars = Object.entries(tokens).flatMap(([name, values]) => {
          const root = Array.isArray(values) ? values.find((entry) => entry.selector === ':root' && !entry.classes?.length) : undefined
          return root?.value ? [`--${name.replace(/^--/, '')}:${root.value}`] : []
        }).join(';')
        if (vars) setPalette(`:root,.official-canvas,.official-tree-host{${vars}}`)
      })
      .catch(() => undefined)
    fetch('/ui-data/themes/darkStone/colors.json')
      .then((response) => (response.ok ? response.json() : null))
      .then((colors: Record<string, string> | null) => {
        if (!active || !colors) return
        const vars = Object.entries(colors).map(([name, value]) => `--${name}:${value}`).join(';')
        setTheme(`:root,.official-canvas,.official-tree-host{${vars}}`)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [uitkHost])
  return <>
    {faces ? <style>{faces}</style> : null}
    {/* The utility classes the trees carry (`textColor_*`, `title_medium`,
        `labelShadow_*`, …) are only defined in the uitk sheet, as `:where()`
        rules that lose to every compiled DarkStone rule. Without it the classic
        screens inherit the DarkStone root colour — near-black text everywhere. */}
    {!uitkHost ? <link rel="stylesheet" href="/uitk/theme.css" /> : null}
    {!uitkHost && base ? <style>{base}</style> : null}
    {!uitkHost && palette ? <style>{palette}</style> : null}
    {!uitkHost && theme ? <style>{theme}</style> : null}
  </>
}
