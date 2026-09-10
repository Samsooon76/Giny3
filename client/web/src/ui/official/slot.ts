import type { VisualTreeNode } from './types'

/** Slot's C# constructor switches its icon/asset interior when an item is
 * assigned. Extracted empty-slot prototypes contain only the icon branch.
 * Reconstruct this shared control, never the inventory window around it. */
export function slotInterior(node: VisualTreeNode, image?: string, quantity?: number): VisualTreeNode[] {
  const current = node.children?.find(child => (child.name || child.binding) === 'itemTile_container')
  const container: VisualTreeNode = current ? { ...current } : {
    type: 'VisualElement', name: 'itemTile_container', binding: 'itemTile_container',
    style: { width: '100%', height: '100%', 'align-items': 'center', 'justify-content': 'center', padding: 2 },
  }
  container.style = { ...container.style, 'background-color': image ? '--buttons_buttonSecondary' : '--black_black35',
    'box-shadow': 'inset 0 0 0 1px rgba(0,0,0,0.25)' }
  if (!image) return [container]
  container.children = [{
    type: 'VisualElement', name: 'itemTile_asset', binding: 'itemTile_asset',
    style: { width: '100%', height: '100%', position: 'relative' },
    children: [{
      type: 'VisualElement', name: 'itemTile_asset_asset', binding: 'itemTile_asset_asset', sprite: image,
      style: { width: '100%', height: '100%', 'background-size': 'contain' },
    }],
  }]
  if (quantity != null && quantity > 1) container.children.push({
    type: 'DofusLabel', name: 'itemTile_counter', binding: 'itemTile_counter', text: String(quantity),
    classes: ['textShort_smallRegular'],
    style: { position: 'absolute', left: 'auto', top: 'auto', width: 'auto', height: 'auto', right: 4, bottom: 2, 'pointer-events': 'none' },
  })
  return [container]
}
