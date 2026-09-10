import type { VisualTreeNode } from './types'
/** Bubble KQe inserts a primary/large grid toggle between ping and point-cell.
 * Clone the parsed official toggle so its sprites, states and USS stay official. */
export function withBubbleCombatControls(node: VisualTreeNode): VisualTreeNode {
  // UI Builder's 100px drag area is a placeholder; this compact official
  // widget uses its authored 24px header as the handle.
  if (node.binding === 'window_challengesSettings') node = { ...node, properties: { ...node.properties, 'drag_handle-height': '24' } }
  let children = node.children?.map(withBubbleCombatControls)
  if (node.binding === 'ctr_toggles' && children && !children.some(c => c.binding === 'tg_tacticalMode')) {
    const source = children.find(c => c.binding === 'tg_pointCell')
    if (source) {
      const copy = structuredClone(source)
      copy.binding = copy.name = 'tg_tacticalMode'; copy.id = 'bubble-tactical-toggle'
      copy.properties = { ...copy.properties, name: 'tg_tacticalMode', 'icon-value': 'grid', iconValue: 'grid' }
      const replaceIcon = (n: VisualTreeNode): VisualTreeNode => ({ ...n, ...(n.sprite ? { sprite: 'icons/grid.png' } : {}), children: n.children?.map(replaceIcon) })
      children = children.flatMap(c => c === source ? [replaceIcon(copy), c] : [c])
    }
  }
  return children ? { ...node, children } : node
}
