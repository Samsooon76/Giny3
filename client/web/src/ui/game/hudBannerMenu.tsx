import { moduleOptions } from '../official/moduleOptions'
import { useCallback, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { layoutStore } from '../official/layoutStore'
import { textTooltip } from '../official/tooltipStore'
import type { BindingOverride, BindingResolver } from '../official/types'
import { bannerSeed, gridForSize } from './bannerGeometry'
import { GAME_WINDOWS, type GameWindow } from './windows'

export const BANNER_WINDOW_ID = 'BannerMenu'

export type OpenFn = (
  key: string,
  label: string,
  tree: GameWindow['tree'],
  size: GameWindow['size'],
  icon?: string,
) => void

const BROWSE_ID = '__browse__'

/** A banner tile carries an interface picto, which is colour art.

    The renderer paints an override on the innermost interior, here
    `itemTile_icon_Vector`, and the official theme gives that node a tint on a
    glyph-button tile (`.itemTile.xSmall.button.icon` → `--uitk-tint:
    var(--highlight_secondary100)`, `#b6b3e6`). `applyUitkEffects` then uses the
    PNG as a mask and fills it with that one colour, which flattens the backpack
    and the crown into blobs. C# fills one interior or the other — the tinted
    Vector for a monochrome glyph, the plain `itemTile_icon` for a bitmap — so
    clearing the token says which of the two this tile is, and leaves every
    other tinted node (window headers, dropdown chevrons) alone. */
const UNTINTED_PICTO = { style: { '--uitk-tint': 'transparent' } as CSSProperties }

/** Fill the official `bannerMenu` tree.

    Everything visible — the window, the official handle, the tile frames — is
    the extracted chrome, and moving or resizing it is the renderer's generic
    `MagneticDragWindow` behaviour. This hook supplies only what the C#
    constructor supplies: how many tiles the current size holds and which
    interface each one opens. Overflow uses `ctr_moreBtn` / `gd_additionalBtns`,
    not a homemade popup. Icons go on `itemTile_icon`, the slot C# paints. */
export function useBannerMenu({
  openIds,
  openTree,
  onBrowse,
  iconOverrides,
}: {
  openIds: Set<string>
  openTree: OpenFn
  onBrowse: () => void
  /** Live pictos the C# factory stamps on a tile (rarely needed). */
  iconOverrides?: Readonly<Record<string, string>>
}): BindingResolver {
  const layouts = useSyncExternalStore(layoutStore.subscribe, layoutStore.snapshot, layoutStore.snapshot)
  const [more, setMore] = useState(false)
  const rect = layouts[BANNER_WINDOW_ID] ?? bannerSeed()
  const grid = gridForSize(rect.w, rect.h)
  const cells = grid.cols * grid.rows
  /** Tile index → the interface it opens. The trailing tile is the overflow. */
  const { entries, hidden } = useMemo(() => {
    const extra = GAME_WINDOWS.length > cells
    const visible = extra ? GAME_WINDOWS.slice(0, Math.max(0, cells - 1)) : GAME_WINDOWS
    return {
      entries: [...visible, ...(extra ? ['more' as const] : [])] as Array<GameWindow | 'more'>,
      hidden: extra ? GAME_WINDOWS.slice(visible.length) : [],
    }
  }, [cells])

  const toggleMore = useCallback(() => setMore((value) => !value), [])

  return useCallback<BindingResolver>((binding, scope) => resolveBannerMenu(binding, scope, {
    entries, hidden, more, openIds, cells, width: rect.w, height: rect.h,
    openTree, onBrowse, toggleMore, iconOverrides,
  }), [cells, entries, hidden, more, onBrowse, iconOverrides, openIds, openTree, rect.h, rect.w, toggleMore])
}

export type BannerMenuActions = {
  entries: Array<GameWindow | 'more'>
  hidden: GameWindow[]
  more: boolean
  openIds: Set<string>
  cells: number
  width: number
  height: number
  openTree: OpenFn
  onBrowse: () => void
  toggleMore: () => void
  iconOverrides?: Readonly<Record<string, string>>
}

export function resolveBannerMenu(
  binding: string,
  scope: string | undefined,
  model: BannerMenuActions,
): BindingOverride | undefined {
  const { entries, hidden, more, openIds, cells, width, height, openTree, onBrowse, toggleMore, iconOverrides } = model
  if (binding === BANNER_WINDOW_ID) return { className: more ? 'hud-banner-menu is-more' : 'hud-banner-menu' }
  if (binding === 'content' && more) return { style: { overflow: 'visible' } }
  // A vertical strip has no row for the handle caption; USS still ships the
  // label. Hide it from geometry. Expanded, C# `set_headerTitle` writes MENUS
  // (the UXML leftover is `[Menu]`, which paints MENU).
  if (binding === 'header_label') return width <= height ? { hidden: true } : { text: 'MENUS' }
  if (binding === 'gd_btnUis') return { repeat: Math.min(cells, entries.length), style: { flexDirection: 'row' } }
  if (binding === 'ctr_moreBtn') return hidden.length ? { hidden: !more } : { hidden: true }
  if (binding === 'gd_additionalBtns') {
    return hidden.length ? { repeat: hidden.length + 1, hidden: false, style: { flexDirection: 'row' } } : { hidden: true }
  }

  const additional = additionalEntry(scope, hidden)
  const main = entries[Number(scope?.match(/^gd_btnUis:(\d+)$/)?.[1] ?? -1)]
  const entry = additional ?? main
  if (!entry) return undefined

  if (isIconBinding(binding)) {
    const sprite = entry === 'more' || entry === BROWSE_ID ? 'plus' : (iconOverrides?.[entry.id] ?? entry.icon)
    return { sprite, ...(binding === 'itemTile_icon_Vector' ? UNTINTED_PICTO : {}), ...(binding === 'itemTile_icon' && moduleOptions.get(BANNER_WINDOW_ID).largeMenuIcons ? { style: { transform: 'scale(1.25)' } } : {}) }
  }
  if (/^slot_\d+$/.test(binding)) {
    if (entry === 'more') {
      return {
        state: more ? 'pressed' : undefined,
        onClick: toggleMore,
      }
    }
    if (entry === BROWSE_ID) {
      return { onClick: onBrowse }
    }
    const icon = iconOverrides?.[entry.id] ?? entry.icon
    return {
      state: openIds.has(entry.id) ? 'pressed' : undefined,
      onClick: () => openTree(entry.id, entry.label, entry.tree, entry.size, icon),
      tooltip: textTooltip(entry.label, entry.shortcut?.toUpperCase()),
    }
  }
  return undefined
}

function additionalEntry(scope: string | undefined, hidden: GameWindow[]): GameWindow | typeof BROWSE_ID | undefined {
  const index = Number(scope?.match(/^gd_additionalBtns:(\d+)$/)?.[1] ?? -1)
  if (index < 0) return undefined
  if (index === hidden.length) return BROWSE_ID
  return hidden[index]
}

function isIconBinding(binding: string): boolean {
  return binding === 'itemTile_icon' || binding === 'itemTile_icon_Vector' || binding === 'itemTile_container'
}
