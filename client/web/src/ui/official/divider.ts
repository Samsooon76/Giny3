import type { VisualTreeNode } from './types'

/** Restore the small ornament holder created by Divider's runtime constructor.
 * The export can invert diamond/diamondContainer and leave both at 100% size. */
export function dividerInterior(node: VisualTreeNode, caption?: string): VisualTreeNode[] | undefined {
  const name = (child: VisualTreeNode) => child.name || child.binding
  const row = node.children?.find(child => name(child) === 'divider_dividerContainer')
  if (!row) return node.children
  const diamond = row.children?.find(child => name(child) === 'divider_diamond')
  const holder = diamond?.children?.find(child => name(child) === 'divider_diamondContainer')
  if (!diamond || !holder) return node.children
  const restored = { ...holder, style: { ...holder.style, width: 12, height: 4, 'flex-shrink': 0 }, children: [
    { ...diamond, sprite: diamond.sprite || 'diamondOutline', style: { ...diamond.style, width: 4, height: 4 }, children: [] },
  ] }
  return node.children?.map(child => child !== row ? child : { ...row, children: row.children?.map(part => {
    if (part === diamond) return restored
    if (name(part) === 'divider_text' && !(caption || part.text || part.properties?.text)) return { ...part, style: { ...part.style, display: 'none' } }
    return part
  }) })
}
