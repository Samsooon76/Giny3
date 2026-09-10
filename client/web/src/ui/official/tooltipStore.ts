/** The in-game tooltip, the C# TooltipManager equivalent.

    Official trees never place themselves: they are runtime documents with no
    left/top, and nothing references them. A resolver declares a tooltip the
    same way it declares onClick; this store is the live instance — which tree,
    which bindings, and the canvas rectangle of the source. The layer that
    renders it lives on the HUD surface so its coordinates stay in canvas px. */

import { OFFICIAL_CANVAS } from './surface'
import type { BindingResolver, TooltipBinding, VisualTreeNode } from './types'

export const TOOLTIP_DELAY_MS = 400
const GAP = 8

export type TooltipRect = { x: number; y: number; w: number; h: number }

export type TooltipRequest = TooltipBinding & {
  /** Identifies the source node so a leave from A does not dismiss B. */
  source: string
  placement?: 'above-center'
  rect: TooltipRect
}

function createStore<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    snapshot: () => state,
    set(next: T) {
      if (next === state) return
      state = next
      for (const listener of listeners) listener()
    },
  }
}

const shown = createStore<TooltipRequest | null>(null)
let pending: { source: string; timer: ReturnType<typeof setTimeout> } | null = null

function clearPending() {
  if (!pending) return
  clearTimeout(pending.timer)
  pending = null
}

export const tooltipStore = {
  subscribe: shown.subscribe,
  snapshot: shown.snapshot,
  show(request: TooltipRequest) {
    clearPending()
    const wait = shown.snapshot() ? 0 : request.delay ?? TOOLTIP_DELAY_MS
    if (wait <= 0) {
      shown.set(request)
      return
    }
    pending = {
      source: request.source,
      timer: setTimeout(() => {
        pending = null
        shown.set(request)
      }, wait),
    }
  },
  /** Dismiss the current (or pending) tooltip. Pass `source` to ignore a leave
      that no longer matches what the pointer is over. */
  hide(source?: string) {
    if (source) {
      if (pending && pending.source !== source) return
      if (!pending && shown.snapshot()?.source !== source) return
    }
    clearPending()
    shown.set(null)
  },
}

/** Selector-safe id for a node, unique across trees so hover USS does not leak
    from the action bar's `slot_0` into the inventory's. */
export function officialUid(tree: string, scope: string | undefined, nodeId: string | number | undefined, binding: string): string {
  return `${tree || 'tree'}-${scope ?? 'root'}-${nodeId ?? binding}`.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export function wantsElidedTooltip(node: VisualTreeNode): boolean {
  const value = node.properties?.['display-tooltip-when-elided'] ?? node.properties?.displayTooltipWhenElided
  return ['true', '1'].includes(String(value ?? '').toLowerCase())
}

export function isTruncated(element: HTMLElement): boolean {
  if (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) return true
  for (const child of element.children) {
    if (!(child instanceof HTMLElement) || child.tagName === 'STYLE') continue
    if (child.scrollWidth > child.clientWidth + 1 || child.scrollHeight > child.clientHeight + 1) return true
  }
  return false
}

/** Prefer below the source, flip above when the canvas runs out, then clamp. */
export function placeTooltip(
  anchor: TooltipRect,
  size: { w: number; h: number },
  canvas: { width: number; height: number } = OFFICIAL_CANVAS,
  gap = GAP,
): { left: number; top: number } {
  const width = Math.max(0, size.w)
  const height = Math.max(0, size.h)
  let left = anchor.x
  let top = anchor.y + anchor.h + gap
  if (top + height > canvas.height) top = anchor.y - height - gap
  const maxLeft = Math.max(0, canvas.width - width)
  const maxTop = Math.max(0, canvas.height - height)
  left = Math.min(maxLeft, Math.max(0, left))
  top = Math.min(maxTop, Math.max(0, top))
  return { left, top }
}

export function textTooltip(text: string, shortcut?: string, delay?: number): TooltipBinding {
  return {
    tree: 'TextTooltip',
    text,
    delay,
    resolve: (binding) => {
      if (binding === 'text') return { text }
      if (binding === 'shortcut') {
        return shortcut
          ? { hidden: false, text: shortcut, style: { display: 'flex' } }
          : { hidden: true }
      }
      return undefined
    },
  }
}

/** Official `ChatTooltip` (`#lbl_text`). Instant: the chat list is the hover. */
export function chatTooltip(text: string): TooltipBinding {
  return {
    tree: 'ChatTooltip',
    text,
    delay: 0,
    resolve: (binding) => (binding === 'lbl_text' ? { text } : undefined),
  }
}

const TOOLTIP_ROOTS = new Set(['textTooltip', 'itemTooltip', 'spellTooltip', 'background', 'StatsTooltip'])

export function tooltipResolve(request: TooltipRequest): BindingResolver {
  return (binding, scope) => {
    const hit = request.resolve?.(binding, scope)
    if (hit) return hit
    if (TOOLTIP_ROOTS.has(binding)) return { hidden: false }
    if (request.text == null) return undefined
    if (binding === 'text') return { text: request.text }
    if (binding === 'lbl_text' && request.tree === 'ChatTooltip') return { text: request.text }
    if (binding === 'shortcut' && request.tree === 'TextTooltip') return { hidden: true }
    return undefined
  }
}

