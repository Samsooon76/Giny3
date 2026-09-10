import type { BindingResolver, VisualTreeNode } from './types'

export type RepeaterItem = {
  key: string
  /** VisualTreeAsset name from the UI cache (makeItem), not a homemade tag. */
  template: string
  /** Dynamically inserted sibling windows participate in their host flex row. */
  flowWindow?: boolean
  resolve: BindingResolver
  /** Nested makeItem (e.g. `gd_spellButtons` → `spellButtonsEntry` inside `spellListEntry`). */
  repeaters?: Repeater
}

export type Repeater = Record<string, RepeaterItem[]>

export const EMPTY_REPEATER: Repeater = {}

export function repeaterTemplateNames(repeaters: Repeater): string[] {
  const names = new Set<string>()
  const walk = (rep: Repeater) => {
    for (const items of Object.values(rep)) {
      for (const item of items) {
        if (item.template) names.add(item.template)
        if (item.repeaters) walk(item.repeaters)
      }
    }
  }
  walk(repeaters)
  return [...names].sort()
}

export function cloneTemplateBody(tree: VisualTreeNode | undefined): VisualTreeNode | undefined {
  if (!tree) return undefined
  // CloneTree inserts every root. fightResultSection contains both the
  // section header and its content as siblings; selecting children[0] silently
  // discarded the fighters, XP and drops.
  const body = tree.type === 'UXML' && tree.children?.length
    ? tree.children.length === 1 ? tree.children[0] : { type: 'VisualElement', style: { width: '100%' }, children: tree.children }
    : tree
  const clone = structuredClone(body)
  // Inline USS is namespaced `uitk-inline-{doc}-{N}` (dofus3-ui README §11).
  // Keep the template's rule_index so `/uitk/trees/{template}.css` can paint
  // the clone; `flowClonedItem` still drops UI Builder `absolute` / `none`.
  flowClonedItem(clone)
  return clone
}

/** InlineXmlGrid prototypes are authored `position: absolute` (and often
    `display: none`) so UI Builder can stack them. C# `makeItem` / ListView
    lays clones in the host's flex; keeping absolute stacks every row at 0,0. */
function flowClonedItem(node: VisualTreeNode): void {
  const style = node.style
  if (!style) return
  const next: Record<string, unknown> = { ...style }
  if (String(next.display).toLowerCase() === 'none') delete next.display
  if (String(next.position).toLowerCase() === 'absolute') {
    next.position = 'relative'
    delete next.left
    delete next.top
    delete next.right
    delete next.bottom
  }
  node.style = next
}

/** UITK ListView / InlineXmlGrid item geometry.

    ``item-width`` / ``item-height`` are the InlineXmlGrid cell (spell buttons
    are 338×67). ``fixed-item-height`` is ListView FixedHeight virtualization.
    DynamicHeight lists keep their template height and only refuse to shrink. */
export function repeaterItemStyle(host: { properties?: Record<string, unknown> }): {
  flexShrink: number
  width?: string
  minWidth?: string
  height?: string
  minHeight?: string
} {
  const style: {
    flexShrink: number
    width?: string
    minWidth?: string
    height?: string
    minHeight?: string
  } = { flexShrink: 0 }
  const props = host.properties ?? {}
  const itemWidth = Number(props['item-width'] ?? props.itemWidth)
  if (Number.isFinite(itemWidth) && itemWidth > 0) {
    style.width = `${itemWidth}px`
    style.minWidth = `${itemWidth}px`
  }
  const itemHeight = Number(props['item-height'] ?? props.itemHeight)
  if (Number.isFinite(itemHeight) && itemHeight > 0) {
    style.height = `${itemHeight}px`
    style.minHeight = `${itemHeight}px`
  }
  const method = String(props['virtualization-method'] ?? props.virtualizationMethod ?? '')
  if (method === 'DynamicHeight' || method === '1') return style
  if (style.height) return style
  const raw = props['fixed-item-height'] ?? props.fixedItemHeight
  const n = Number(raw)
  if (Number.isFinite(n) && n > 0) {
    style.height = `${n}px`
    style.minHeight = `${n}px`
  }
  return style
}

/** Expand one ListView/Grid host into cloned official template bodies. */
export function expandRepeater(
  hostBinding: string,
  repeaters: Repeater,
  templates: Record<string, VisualTreeNode>,
): Array<{ key: string; template: string; node: VisualTreeNode }> {
  const items = repeaters[hostBinding] ?? []
  const out: Array<{ key: string; template: string; node: VisualTreeNode }> = []
  for (const item of items) {
    const node = cloneTemplateBody(templates[item.template])
    if (!node) continue
    out.push({ key: item.key, template: item.template, node })
  }
  return out
}
