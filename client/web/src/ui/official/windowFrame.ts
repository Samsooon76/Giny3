/** Host framing and constructor size stamps for extracted UI trees. */
import type { VisualTreeNode } from './types'
import { stampFigmaHeaders } from './windowHeaders'
import { unwrapHost, isWindowNode, declaredSize, WINDOW_ID_PROPERTY, WINDOW_TITLE_PROPERTY, WINDOW_ICON_PROPERTY,
  WINDOW_WIDTH_PROPERTY, WINDOW_HEIGHT_PROPERTY, WINDOW_FLOW_PROPERTY, WINDOW_CHROME_PROPERTY } from './windowChrome'

function clusteredHostWindows(screen: VisualTreeNode): VisualTreeNode[] | undefined {
  const host = unwrapHost(screen)
  if (isWindowNode(host)) return [host]
  const kids = host.children ?? []
  if (!kids.length || !kids.every(isWindowNode)) return undefined
  return kids
}

function stampNode(screen: VisualTreeNode, target: VisualTreeNode, stamp: Record<string, string>): VisualTreeNode {
  if (screen === target) return { ...screen, properties: { ...screen.properties, ...stamp } }
  if (!screen.children?.length) return screen
  return { ...screen, children: screen.children.map((child) => stampNode(child, target, stamp)) }
}

function stampEach(screen: VisualTreeNode, stamps: Map<VisualTreeNode, Record<string, string>>): VisualTreeNode {
  const extra = stamps.get(screen)
  const children = screen.children?.map((child) => stampEach(child, stamps))
  if (!extra) return children ? { ...screen, children } : screen
  return { ...screen, properties: { ...screen.properties, ...extra }, ...(children ? { children } : {}) }
}

function hasWindowDescendant(node: VisualTreeNode): boolean {
  if (isWindowNode(node)) return true
  return (node.children ?? []).some(hasWindowDescendant)
}

function stampDescendantWindows(screen: VisualTreeNode, stamp: Record<string, string>): VisualTreeNode {
  const extra = isWindowNode(screen) ? stamp : undefined
  const children = screen.children?.map((child) => stampDescendantWindows(child, stamp))
  if (!extra) return children ? { ...screen, children } : screen
  return { ...screen, properties: { ...screen.properties, ...extra }, ...(children ? { children } : {}) }
}

/** Frame a tree that ships no official window.

    Single WindowFigma at the unwrapped host (inventory, cosmetics, AppearanceUI
    behind its VisualElement): stamp id / optional title / icon. Stamp catalogue
    size on a percentage or missing axis (recipes 100%, spells no width).
    Declared pixel sizes stay.

    Several sibling WindowFigmas (bank 492+492, auction 872+492): they already
    are the C# hosts. Do not wrap them. Stamp `giny-window-flow` so the
    renderer leaves the USS flex row alone, and the HUD close id on each.

    Mixed children (craft, cartography): C# hosts the UXML as a screen, not a
    WindowFigma. Do not invent a frame. Nested WindowFigmas keep USS chrome
    (`giny-window-chrome`) so overlays stay pinned and flex columns stay in
    flow. */
export function withWindowFrame(
  screen: VisualTreeNode,
  options: { id: string; title?: string; icon?: string; shortcut?: string; size: { width: number; height: number } },
): VisualTreeNode {
  if (options.id === 'recipes') {
    const showRecipeTitle = (node: VisualTreeNode): VisualTreeNode => ({
      ...node,
      ...(node.name === 'ItemRecipes' ? { properties: { ...node.properties, 'with-title-bar': 'true' } } : {}),
      children: node.children?.map(showRecipeTitle),
    })
    screen = showRecipeTitle(screen)
  }
  if (options.id === 'breeding') {
    const titleStorage = (n: VisualTreeNode): VisualTreeNode => ({ ...n, ...(n.name === 'storageWindow' ? { properties: { ...n.properties, 'with-title-bar': 'true', 'header-title': 'Inventaire' } } : {}), children: n.children?.map(titleStorage) })
    screen = titleStorage(screen)
  }
  const identity = {
    [WINDOW_ID_PROPERTY]: options.id,
    ...(options.shortcut ? { 'shortcut-value': `KEY:${options.shortcut}` } : {}),
    ...(options.title ? { [WINDOW_TITLE_PROPERTY]: options.title } : {}),
    ...(options.icon ? { [WINDOW_ICON_PROPERTY]: options.icon } : {}),
  }
  const hostSize = {
    [WINDOW_WIDTH_PROPERTY]: String(options.size.width),
    [WINDOW_HEIGHT_PROPERTY]: String(options.size.height),
  }
  const clustered = clusteredHostWindows(screen)
  if (clustered?.length === 1) {
    // Cosmetics: height 880, no width, columns 520+784. Spells: height 940.
    const existing = clustered[0]
    const declared = declaredSize(existing.style)
    const stamp = {
      ...identity,
      ...(!declared.width ? { [WINDOW_WIDTH_PROPERTY]: String(options.size.width) } : {}),
      ...(!declared.height ? { [WINDOW_HEIGHT_PROPERTY]: String(options.size.height) } : {}),
    }
    return stampFigmaHeaders(stampNode(screen, existing, stamp))
  }
  if (clustered && clustered.length > 1) {
    const stamps = new Map<VisualTreeNode, Record<string, string>>()
    for (const host of clustered) {
      stamps.set(host, { [WINDOW_ID_PROPERTY]: options.id, [WINDOW_FLOW_PROPERTY]: 'true' })
    }
    return stampFigmaHeaders(stampEach(screen, stamps))
  }
  if (hasWindowDescendant(screen)) {
    return stampFigmaHeaders(stampDescendantWindows(screen, { [WINDOW_CHROME_PROPERTY]: 'true' }))
  }
  // A fragment with no WindowFigma (interface browser). C# still hosts it
  // in a window; the client builds the same chrome rather than spilling the
  // panel across the canvas.
  const content: VisualTreeNode = {
    id: `giny-content-${options.id}`,
    type: 'VisualElement',
    name: `giny_window_content_${options.id}`,
    classes: ['giny-window-content'],
    style: {
      position: 'relative',
      width: { value: 100, unit: '%' },
      height: { value: 100, unit: '%' },
      'flex-grow': 1,
      overflow: 'hidden',
    },
    children: screen.children ?? [],
  }
  const frame: VisualTreeNode = {
    id: `giny-frame-${options.id}`,
    type: 'WindowFigma',
    name: `giny_window_${options.id}`,
    classes: ['giny-window-frame'],
    style: {
      position: 'absolute',
      width: { value: options.size.width, unit: 'px' },
      height: { value: options.size.height, unit: 'px' },
    },
    properties: {
      ...identity, ...hostSize,
      'is-movable': 'true', 'with-title-bar': 'true', 'show-close-button': 'true',
      'corner-resizable': 'true', 'horizontal-resizable': 'true', 'vertical-resizable': 'true',
    },
    children: [content],
  }
  return stampFigmaHeaders({ ...screen, children: [frame] })
}

