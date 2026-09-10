/** What the official window components declare about their own chrome.

    `MagneticDragWindow` and `WindowFigma` are C# components: the UXML stores
    their flags as attributes and the constructor turns them into a drag handle,
    resize grips and a title bar. The extractor keeps those attributes, so this
    module reads them back instead of hard-coding one window's behaviour. */

import type { VisualTreeNode } from './types'
import type { HeaderStyle } from './windowChromeStyles'
import type { Rect, Bounds } from './magnetism'

export type DragPosition = 'Custom' | 'Top' | 'Bottom' | 'Left' | 'Right'
export type WindowKind = 'magnetic' | 'figma'

export type WindowChrome = {
  kind: WindowKind
  /** Layout key: the official element name, or the host's own id for a tree
      the client frames itself. */
  id: string
  movable: boolean
  resize: { horizontal: boolean; vertical: boolean; corner: boolean }
  magnetic: boolean
  magneticForOthers: boolean
  snapPreview: boolean
  /** `x/yMagneticOffset`: the gap the window keeps once it snaps. */
  offset: { x: number; y: number }
  /** `drag_handle-height`, when the official handle is taller than its USS. */
  handleHeight?: number
  dragPosition: DragPosition
  title?: string
  icon?: string
  /** `header-style`: which `.header` variant the window's title bar is. */
  headerStyle: HeaderStyle
  closeButton: boolean
  /** `show-help-button`. Omit-default is false — StatSheet / PlayerSpell
      UXML have no help control; auction `help-icon="cog"` does. */
  helpButton: boolean
  /** `help-icon` / `help-button-icon` enum name (`cog`, `questionMark`, …). */
  helpIcon?: string
  titleBar: boolean
  /** `no-ornament-header`: C# still builds the bar, without the side filigree. */
  ornament: boolean
  modal: boolean
  /** `shortcut-value` after `HeaderWindow.CreateTitleShortCut` / `ParseValues`.
      Only the KEY token (or a bare letter like companion `V`). `KEY:S` → `S`.
      StatSheet has no UXML value — do not invent `C`. */
  shortcut?: string
  /** Magnetic `header-icon-left`. Omit-default is none (chat sets `expand`). */
  leftIcon?: string
  /** Magnetic `header-icon-right`. Serialized omit is enum 0 (`none`) with
      `UxmlAttributeFlags=0`; `CreateHeader` still fills `#header_buttonRight`
      with `moreActions` (official chat / quests / mini-carte kebab). Explicit
      `header-icon-right="none"` hides the slot. */
  rightIcon?: string
  /** Official child that is the drag surface. `MagneticDragWindow` ships
      `header` in UXML. `WindowFigma` gets the same id from the constructor
      (extractor / `stampFigmaHeaders`). */
  handleName?: string
  /** Host size stamped on axes the USS leaves open (`width: 100%`, or no
      width at all). Pixel axes stay on the stylesheet. */
  fallbackSize?: { width?: number; height?: number }
}

/** Synthetic properties the host stamps on a tree it frames itself. */
export const WINDOW_ID_PROPERTY = 'giny-window-id'
export const WINDOW_TITLE_PROPERTY = 'giny-window-title'
export const WINDOW_ICON_PROPERTY = 'giny-window-icon'
export const WINDOW_WIDTH_PROPERTY = 'giny-window-width'
export const WINDOW_HEIGHT_PROPERTY = 'giny-window-height'
/** Sibling WindowFigmas that stay in their USS flex row (bank, auction). */
export const WINDOW_FLOW_PROPERTY = 'giny-window-flow'
/** Nested WindowFigmas on a C# screen (craft, cartography overlays). Chrome
    without canvas placement, USS position kept. */
export const WINDOW_CHROME_PROPERTY = 'giny-window-chrome'

const WINDOW_TYPES: Record<string, WindowKind> = { MagneticDragWindow: 'magnetic', WindowFigma: 'figma' }
/** Kebab and camel spellings both come out of the extractor, depending on
    whether the attribute was authored in UXML or set from code. */
const camel = (key: string) => key.replace(/[-_]([a-z])/g, (_, letter: string) => letter.toUpperCase())

function property(node: VisualTreeNode, key: string): string | undefined {
  const properties = node.properties ?? {}
  const value = properties[key] ?? properties[camel(key)]
  return value == null ? undefined : String(value)
}

function flag(node: VisualTreeNode, key: string, fallback: boolean): boolean {
  const value = property(node, key)
  if (value == null) return fallback
  return ['true', '1', 'yes'].includes(value.toLowerCase())
}

function number(node: VisualTreeNode, key: string): number | undefined {
  const value = Number.parseFloat(property(node, key) ?? '')
  return Number.isFinite(value) ? value : undefined
}

/** `dragPosition` is serialised both as the enum name and as its ordinal. */
const DRAG_POSITIONS: Record<string, DragPosition> = { '1': 'Top', '2': 'Bottom', '3': 'Left', '4': 'Right', '5': 'Custom' }

const DRAG_POSITION_NAMES = new Set<DragPosition>(['Custom', 'Top', 'Bottom', 'Left', 'Right'])

function dragPosition(node: VisualTreeNode): DragPosition {
  const named = property(node, 'drag-position') as DragPosition | undefined
  if (named && DRAG_POSITION_NAMES.has(named)) return named
  return DRAG_POSITIONS[property(node, 'dragPosition') ?? ''] ?? 'Custom'
}

/** `none` is how the UXML says a slot carries no icon at all. */
function iconName(value: string | undefined): string | undefined {
  if (!value || value.toLowerCase() === 'none') return undefined
  return value
}

/** UXML icon trait: missing uses `fallback`; explicit `none` stays empty. */
function authoredIcon(node: VisualTreeNode, key: string, fallback?: string): string | undefined {
  const value = property(node, key)
  if (value == null) return fallback
  return iconName(value)
}

/** `ShortcutFigs.ParseValues` tokens. HeaderWindow only paints the KEY.
    UXML: `KEY:S`, `KEY:F`, companion `V`. `ICON:` is a mouse sprite, not a letter. */
export function shortcutKey(value: string | undefined): string | undefined {
  if (!value) return undefined
  for (const token of value.split(',')) {
    const piece = token.trim()
    if (!piece) continue
    const split = piece.indexOf(':')
    if (split < 0) return piece
    const kind = piece.slice(0, split).toUpperCase()
    const body = piece.slice(split + 1)
    if (kind === 'KEY' && body) return body
  }
  return undefined
}

/** UXML constructor slots C# replaces. English leftovers are not captions.

    Storage `TrySetTitleToWindow` + `isCosmeticStorage` / `btnBank` pair the
    WindowFigma name with the named-index key. CosmeticUi reuses the same
    `[Inventory]` slot as PlayerInventory; mapping it globally stamped
    «Inventaire» on the cosmetics window. */
const CONSTRUCTOR_TITLES: Record<string, Record<string, string>> = {
  PlayerInventory: { Inventory: 'Inventaire' }, // ui.common.inventory
  CosmeticUi: { Inventory: 'Cosmétiques' }, // ui.common.cosmetics
  BankWindow: { Bank: 'Banque' }, // ui.common.bank
  // IL2CPP `UiWidgetMinimap` → named index `ui.widgetMinimap`. USS
  // `.header.widget.horizontal.large #header_label` uses `section_medium`
  // (`--text-case: UPPER`), so the painted caption is MINI CARTE.
  CartographyBanner: { 'MINI-MAP': 'Mini carte' },
}

const CONSTRUCTOR_SLOTS = new Set(['Headline', 'Inventory', 'Bank', 'Item List', 'Texte Titre'])

function text(value: string | undefined, windowName?: string): string | undefined {
  if (!value) return undefined
  // Ankama ships untranslated keys bracketed. Named-index keys are inlined
  // into the cache; a leftover `[Menu]` / `[GROUPE]` is the authored
  // caption, not a prompt to invent French. `[MINI-MAP]` is the
  // CartographyBanner constructor slot (`UiWidgetMinimap`).
  const cleaned = value.replace(/^\[(.*)]$/, '$1').trim()
  if (!cleaned) return undefined
  const mapped = windowName ? CONSTRUCTOR_TITLES[windowName]?.[cleaned] : undefined
  if (mapped) return mapped
  if (CONSTRUCTOR_SLOTS.has(cleaned) || cleaned.toLowerCase() === 'headline') return undefined
  return cleaned
}

/** Cheap test the renderer runs on every node before it looks any closer. */
export function isWindowNode(node: VisualTreeNode): boolean {
  return WINDOW_TYPES[node.type ?? ''] !== undefined
}

export function isFlowWindow(node: VisualTreeNode): boolean {
  return ['true', '1'].includes(String(node.properties?.[WINDOW_FLOW_PROPERTY] ?? '').toLowerCase())
}

export function isChromeOnlyWindow(node: VisualTreeNode): boolean {
  return ['true', '1'].includes(String(node.properties?.[WINDOW_CHROME_PROPERTY] ?? '').toLowerCase())
}

/** Unwrap single-child wrappers until the host level (WindowFigmas, or mixed).

    AppearanceUI is UXML → VisualElement → WindowFigma. Bank is
    UXML → storageBankRoot → storageBank → [BankWindow, StorageWindow]. */
export function unwrapHost(screen: VisualTreeNode): VisualTreeNode {
  let current = screen
  while ((current.children?.length ?? 0) === 1 && !isWindowNode(current.children![0])) {
    current = current.children![0]
  }
  return current
}

/** WindowFigma / MagneticDragWindow children at the unwrapped host level. */
export function hostWindows(screen: VisualTreeNode): VisualTreeNode[] {
  const host = unwrapHost(screen)
  if (isWindowNode(host)) return [host]
  return (host.children ?? []).filter(isWindowNode)
}

export function readWindowChrome(node: VisualTreeNode): WindowChrome | undefined {
  const kind = WINDOW_TYPES[node.type ?? '']
  if (!kind) return undefined
  const id = property(node, WINDOW_ID_PROPERTY) ?? node.binding ?? node.name
  if (!id) return undefined

  // Every extracted `MagneticDragWindow` carries the `magneticwindow` and
  // `resizablewindow` classes: the component's own defaults. Only an explicit
  // `false` locks a window down, which is how the action bar stays put.
  const movable = flag(node, 'is-movable', true)
  const resize = {
    horizontal: flag(node, 'horizontal-resizable', kind === 'magnetic'),
    vertical: flag(node, 'vertical-resizable', kind === 'magnetic'),
    corner: flag(node, 'corner-resizable', kind === 'magnetic'),
  }
  const handleName = (node.children ?? []).some((child) => (child.name ?? child.binding) === 'header') ? 'header' : undefined
  const titleBar = kind === 'figma'
    ? !flag(node, 'hide-title-bar', false) && flag(node, 'with-title-bar', !flag(node, 'no-ornament-header', false))
    : false

  return {
    kind,
    id,
    movable,
    resize,
    magnetic: kind === 'magnetic' ? flag(node, 'is-magnetic', true) : false,
    magneticForOthers: kind === 'magnetic' ? flag(node, 'is-magnetic-for-others', true) : false,
    snapPreview: kind === 'magnetic' ? flag(node, 'allow-snap-preview', true) : true,
    offset: { x: number(node, 'x-magnetic-offset') ?? 0, y: number(node, 'y-magnetic-offset') ?? 0 },
    handleHeight: number(node, 'drag_handle-height'),
    dragPosition: dragPosition(node),
    // The official title wins. Constructor slots (`Headline`, unmapped
    // `Inventory`) are holes C# fills from i18n; the host catalogue label is a
    // Giny name. Leave the hole rather than stamp `Monture` / `Carte` over it.
    title: text(property(node, 'header-title') ?? property(node, 'title'), node.name),
    // A widget names its icon with `header-icon`, a `WindowFigma` with the
    // `img-url` of a Figma menu icon. The host's own is the last resort, for a
    // tree it framed itself.
    icon: iconName(property(node, 'header-icon')) ?? iconName(property(node, 'img-url')) ?? property(node, WINDOW_ICON_PROPERTY),
    headerStyle: (property(node, 'header-style') ?? '').toLowerCase() === 'secondary' ? 'secondary' : 'primary',
    closeButton: kind === 'figma' ? flag(node, 'show-close-button', true) : false,
    helpButton: kind === 'figma' ? flag(node, 'show-help-button', false) : false,
    helpIcon: kind === 'figma'
      ? iconName(property(node, 'help-icon') ?? property(node, 'help-button-icon'))
      : undefined,
    titleBar,
    ornament: kind === 'figma' ? !flag(node, 'no-ornament-header', false) : false,
    modal: flag(node, 'is-modal', false),
    shortcut: kind === 'figma' ? shortcutKey(property(node, 'shortcut-value')) : undefined,
    leftIcon: kind === 'magnetic' ? authoredIcon(node, 'header-icon-left') : undefined,
    rightIcon: kind === 'magnetic' ? authoredIcon(node, 'header-icon-right', 'moreActions') : undefined,
    handleName,
    fallbackSize: stampedHostSize(node),
  }
}

function stampedHostSize(node: VisualTreeNode): WindowChrome['fallbackSize'] {
  const width = number(node, WINDOW_WIDTH_PROPERTY)
  const height = number(node, WINDOW_HEIGHT_PROPERTY)
  if (width == null && height == null) return undefined
  return { ...(width != null ? { width } : {}), ...(height != null ? { height } : {}) }
}

/** The surface that starts a move. `WindowFigma` has no UXML handle — C#
    builds the title bar — but that bar is still the only drag surface. A
    MagneticDragWindow without a `header` child (a notification) still moves
    from any inert part of itself. */
export function hasDragHandle(chrome: Pick<WindowChrome, 'handleName' | 'titleBar'>): boolean {
  return Boolean(chrome.handleName || chrome.titleBar)
}

type DragTarget = { closest(selector: string): unknown }

export function allowsWindowDrag(
  chrome: Pick<WindowChrome, 'movable' | 'handleName' | 'titleBar'>,
  target: DragTarget | null,
  locked = false,
): boolean {
  if (!target) return false
  if (target.closest('[data-window-grip]')) return true
  if (!chrome.movable || locked) return false
  if (target.closest('button, input, textarea, select, [data-no-drag]')) return false
  if (hasDragHandle(chrome) && !target.closest('[data-drag-handle]')) return false
  return true
}

/** Resolve a USS dimension against the space it is measured in.

    `relative` says whether a percentage means anything here. It does for a
    coordinate — `right: 0` and `left: 50%` both place a window in the canvas —
    but not for a window's own size: `width: 100%` means "fill the host the C#
    client gives me", and the window *is* that host, so it declares no size. */
function dimension(value: unknown, extent: number, relative = true): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (!Number.isFinite(parsed)) return undefined
    if (!value.trim().endsWith('%')) return parsed
    return relative ? (parsed / 100) * extent : undefined
  }
  if (value && typeof value === 'object' && 'value' in value) {
    const record = value as { value: unknown; unit?: string }
    if (typeof record.value !== 'number' || !Number.isFinite(record.value)) return undefined
    if (record.unit !== '%') return record.value
    return relative ? (record.value / 100) * extent : undefined
  }
  return undefined
}

/** Where the official stylesheet puts a window before the player moves it.

    A widget is authored against the runtime canvas with whichever pair of
    `left/right` and `top/bottom` its designer pinned it by, so both forms are
    resolved here and the result is always a plain rectangle. */
export function rectFromStyle(
  style: Record<string, unknown> | undefined,
  bounds: Bounds,
  fallback: { width: number; height: number },
  /** `drag-position`: the edge the component docks against when its USS pins
      nothing on that axis. Only `Custom` leaves the window where it lands. */
  anchor: DragPosition = 'Custom',
  /** Safe area reserved by the HUD shell above the runtime canvas. */
  insetTop = 0,
): Rect {
  const source = style ?? {}
  const width = dimension(source.width, bounds.width, false) ?? fallback.width
  const height = dimension(source.height, bounds.height, false) ?? fallback.height
  const left = dimension(source.left, bounds.width)
  const right = dimension(source.right, bounds.width)
  const top = dimension(source.top, bounds.height)
  const bottom = dimension(source.bottom, bounds.height)
  const centredX = anchor === 'Left' ? 0 : anchor === 'Right' ? bounds.width - width : Math.round((bounds.width - width) / 2)
  const centredY = anchor === 'Top' ? insetTop : anchor === 'Bottom' ? bounds.height - height : Math.round(insetTop + (bounds.height - insetTop - height) / 2)
  const x = left ?? (right != null ? bounds.width - right - width : centredX)
  const y = top ?? (bottom != null ? bounds.height - bottom - height : centredY)
  return { x, y, w: width, h: height }
}



/** Which axes the stylesheet gives a real pixel size for.

    `width: 100%` is not a size: it measures the host C# gives the window, and
    the window *is* that host. A missing axis is the same hole — stamp the
    catalogue size rather than shrink-wrap a 76px spell icon. Declared pixels
    (quests 1330×930, cosmetics height 880) stay. */
export function declaredSize(style: Record<string, unknown> | undefined): { width: boolean; height: boolean } {
  const source = style ?? {}
  return {
    width: dimension(source.width, 0, false) != null,
    height: dimension(source.height, 0, false) != null,
  }
}

const DEFAULT_INTRINSIC = { width: 480, height: 360 }

/** Axes still waiting on a content measure.

    A stamped axis (`giny-window-width` / `giny-window-height`) is already
    the C# host size. Measuring the shrink-wrapped interior overwrites it
    (recipes: 542×422, `lv_recipe` collapsed to 8 px; spells: 76 px). */
export function pendingContentMeasure(
  chrome: WindowChrome,
  node: VisualTreeNode,
  seeded: { w?: number; h?: number } = {},
): { width: boolean; height: boolean } {
  const declared = declaredSize(node.style)
  return {
    width: !declared.width && seeded.w == null && chrome.fallbackSize?.width == null,
    height: !declared.height && seeded.h == null && chrome.fallbackSize?.height == null,
  }
}

/** Opening size: a stamped axis wins over a later content measure. */
export function windowIntrinsicSize(
  chrome: WindowChrome,
  measured?: { w: number; h: number },
): { width: number; height: number } {
  return {
    width: chrome.fallbackSize?.width ?? measured?.w ?? DEFAULT_INTRINSIC.width,
    height: chrome.fallbackSize?.height ?? measured?.h ?? DEFAULT_INTRINSIC.height,
  }
}

/** Persist placement, but reapply current constructor dimensions on fixed axes.
 * An old fallback size saved by a drag must not freeze a corrected UI size. */
export function restoreFixedWindowSize<T extends { w: number; h: number }>(chrome: WindowChrome, stored: T): T {
  const w = !chrome.resize.horizontal && !chrome.resize.corner ? chrome.fallbackSize?.width ?? stored.w : stored.w
  const h = !chrome.resize.vertical && !chrome.resize.corner ? chrome.fallbackSize?.height ?? stored.h : stored.h
  return w === stored.w && h === stored.h ? stored : { ...stored, w, h }
}
