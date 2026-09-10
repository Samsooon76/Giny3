import { cssText } from './uss'
import type { VisualTreeNode } from './types'

/** CSS suffixes for the official interaction states compiled into a tree. */
export const STATE_SUFFIX: Record<string, string> = {
  hover: ':hover',
  pressed: ':active',
  focus: ':focus-within',
  disabled: '[data-disabled="true"]',
  // A toggled control has no pointer pseudo-class: only the client knows it is
  // on, so `data-state` is the whole story for these two.
  checked: '[data-state="checked"]',
  selected: '[data-state="selected"]',
}

/** A tinted official sprite is one paint. PlayButton layers carry the image
    on the node and the tint on a `:disabled` ancestor rule; splitting them
    leaves the raw white Figs PNG on screen as stacked bars. */
const PAINT_KEYS = [
  'background-image',
  'unity-background-image-tint-color',
  '-unity-background-image-tint-color',
  'background-size',
  'unity-background-scale',
  'unity-slice-top',
  'unity-slice-right',
  'unity-slice-bottom',
  'unity-slice-left',
  'mask-image',
] as const

/** Properties a node's own or ancestor-scoped states rewrite.

    The renderer used to apply the compiled base as a React `style` object.
    Inline declarations beat `:hover` / `:active` / `[data-state]` rules, so
    every official hover tint was a no-op. Those overlapping properties have
    to live in the same stylesheet as the state rules. */
export function cascadeKeys(node: VisualTreeNode): Set<string> {
  const keys = new Set<string>()
  for (const style of Object.values(node.states ?? {})) {
    for (const key of Object.keys(style ?? {})) keys.add(key)
  }
  for (const entry of node.ancestor_states ?? []) {
    for (const key of Object.keys(entry.style ?? {})) keys.add(key)
  }
  if (PAINT_KEYS.some((key) => keys.has(key))) {
    for (const key of PAINT_KEYS) keys.add(key)
  }
  return keys
}

/** Split compiled USS so state rules can override the base.

    Layout that no state touches stays inline (the window frame, a binding
    override, a drag handle still win). Anything a state redefines is emitted
    as a CSS rule on `[data-official-id]`, next to the `:hover` rule. */
export function splitCascade(node: VisualTreeNode): {
  inlineUss: Record<string, unknown>
  cssUss: Record<string, unknown>
} {
  const inlineUss: Record<string, unknown> = { ...(node.style ?? {}) }
  const cssUss: Record<string, unknown> = {}
  for (const key of cascadeKeys(node)) {
    if (!(key in inlineUss)) continue
    cssUss[key] = inlineUss[key]
    delete inlineUss[key]
  }
  return { inlineUss, cssUss }
}

/** Selectors that put an element in one official state.

    A cache state name can require several states at once (`focus+hover`, which
    the official sheets spell `:focus:hover`). It is the intersection of its
    parts, so every part's condition has to hold. */
export function stateSelectors(selector: string, state: string): string[] {
  const suffixes = state.split('+').map((part) => STATE_SUFFIX[part])
  if (suffixes.some((suffix) => !suffix)) return []
  return [...new Set([`${selector}${suffixes.join('')}`, `${selector}[data-state="${state}"]`])]
}

/** Stylesheet text for one node's compiled base (the overridable slice) and
    every official state that can replace it. */
export function nodeCascadeCss(uid: string, node: VisualTreeNode, ancestorIds: string[]): string {
  const selector = `[data-official-id="${uid}"]`
  const { cssUss } = splitCascade(node)
  const parts: string[] = []
  if (Object.keys(cssUss).length) parts.push(`${selector}{${cssText(cssUss)}}`)
  for (const [state, stateStyle] of Object.entries(node.states ?? {})) {
    const rules = stateSelectors(selector, state)
    if (rules.length) parts.push(`${rules.join(',')}{${cssText(stateStyle)}}`)
  }
  for (const { state, depth, style: stateStyle, self_state, requires } of node.ancestor_states ?? []) {
    const conditions = [{ depth, state }, ...(requires ?? [])].sort((a, b) => b.depth - a.depth)
    let selectorChains = ['']
    let valid = true
    for (const cond of conditions) {
      const ancestor = ancestorIds[ancestorIds.length - cond.depth]
      if (!ancestor) {
        valid = false
        break
      }
      const sels = stateSelectors(`[data-official-id="${ancestor}"]`, cond.state)
      if (!sels.length) {
        valid = false
        break
      }
      selectorChains = selectorChains.flatMap((prefix) => sels.map((s) => (prefix ? `${prefix} ${s}` : s)))
    }
    if (!valid || !selectorChains.length) continue
    const selfSuffix = self_state ? (STATE_SUFFIX[self_state] ?? `[data-state="${self_state}"]`) : ''
    const target = `${selector}${selfSuffix}`
    const rules = selectorChains.map((chain) => `${chain} ${target}`)
    if (rules.length) parts.push(`${rules.join(',')}{${cssText(stateStyle)}}`)
  }
  return parts.join('')
}

/** True when this node has an official pointer state of its own. Ancestor
    hover styles still fire from the ancestor; they do not make this node a
    target. */
export function hasPointerState(node: VisualTreeNode): boolean {
  const states = node.states ?? {}
  return Boolean(states.hover || states.pressed || states.focus)
}
