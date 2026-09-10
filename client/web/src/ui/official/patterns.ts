import type { VisualTreeNode } from './types'

/** Giny primitives. Dofus 3 is UI Toolkit (UXML/USS), not uGUI: there is no
    RectTransform / ScrollRect / TMP to map. The equivalents live here so a
    later renderer can consume this AST without walking every VisualElement. */
export type GinyPrimitive =
  | 'Window'
  | 'Header'
  | 'Text'
  | 'Button'
  | 'NineSlice'
  | 'FlexRow'
  | 'FlexColumn'
  | 'ScrollView'
  | 'ItemGrid'
  | 'ItemSlot'
  | 'Toggle'
  | 'TextInput'
  | 'Dropdown'
  | 'Image'
  | 'Progress'
  | 'Entity'
  | 'Panel'

/** Layout facts copied from USS. Never resolved to left/top/width/height:
    UITK flex and absolute offsets stay as authored until a layout engine
    (today: the browser) computes a box. */
export type GinyLayout = Record<string, unknown>

export type GinySource = {
  tree?: string
  path: string
  name?: string
  type?: string
  fullType?: string
  id?: string | number
  classes: string[]
  sprite?: string
}

export type GinyNode = {
  component: GinyPrimitive
  name?: string
  text?: string
  layout: GinyLayout
  visual?: {
    sprite?: string
    color?: unknown
    nineSlice?: [number, number, number, number]
  }
  source: GinySource
  children: GinyNode[]
}

const WINDOW_TYPES = new Set(['WindowFigma', 'MagneticDragWindow'])
const TEXT_TYPES = new Set(['DofusLabel', 'Label', 'Tag', 'TableColumnHeader', 'ShortcutFigs'])
const BUTTON_TYPES = new Set([
  'PlayButton', 'DofusButtonCustom', 'DofusButton', 'DofusTab', 'DofusToggleButtonCustom',
  'Button', 'DropdownButton',
])
const TOGGLE_TYPES = new Set([
  'CheckboxCustom', 'Checkbox', 'Switch', 'RadioButton', 'RadioButtonCustom',
])
const DROPDOWN_TYPES = new Set(['Dropdown'])
const SCROLL_TYPES = new Set(['ScrollView', 'ListView'])
const GRID_TYPES = new Set(['SlotGrid', 'StorageSlotGrid', 'InlineXmlGrid'])
const SLOT_TYPES = new Set(['Slot', 'Tile'])
const IMAGE_TYPES = new Set(['Image', 'DofusIcon'])
const PROGRESS_TYPES = new Set([
  'ExtendedProgressBarFloat', 'ExtendedProgressBarInt', 'ExtendedProgressBarLong', 'ProgressBar',
])
const ENTITY_TYPES = new Set(['EntityDisplayer', 'EntityPortrait'])
const INPUT_TYPES = new Set(['TextInput', 'TextInputToValidate'])

const WINDOW_CHROME = new Set(['window_background', 'window_shadow', 'window_inner'])
const WINDOW_BODY = 'window_content'
const HEADER_NAMES = new Set(['header', 'headerParent'])

const LAYOUT_KEYS = [
  'position', 'left', 'right', 'top', 'bottom',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'flex-direction', 'flex-grow', 'flex-shrink', 'flex-basis', 'flex-wrap',
  'justify-content', 'align-items', 'align-self', 'align-content',
  'gap', 'row-gap', 'column-gap',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'overflow', 'display',
] as const

export function ginyPrimitive(node: VisualTreeNode): GinyPrimitive {
  const type = node.type ?? 'VisualElement'
  if (WINDOW_TYPES.has(type)) return 'Window'
  if (HEADER_NAMES.has(nodeName(node)) && !WINDOW_TYPES.has(type)) return 'Header'
  if (TEXT_TYPES.has(type)) return 'Text'
  if (BUTTON_TYPES.has(type)) return 'Button'
  if (TOGGLE_TYPES.has(type)) return 'Toggle'
  if (DROPDOWN_TYPES.has(type)) return 'Dropdown'
  if (INPUT_TYPES.has(type)) return 'TextInput'
  if (SCROLL_TYPES.has(type)) return 'ScrollView'
  if (GRID_TYPES.has(type)) return 'ItemGrid'
  if (SLOT_TYPES.has(type)) return 'ItemSlot'
  if (IMAGE_TYPES.has(type)) return 'Image'
  if (PROGRESS_TYPES.has(type)) return 'Progress'
  if (ENTITY_TYPES.has(type)) return 'Entity'
  if (nineSlice(node.style)) return 'NineSlice'
  const direction = String(node.style?.['flex-direction'] ?? '').toLowerCase()
  if (direction.includes('row')) return 'FlexRow'
  if (direction.includes('column')) return 'FlexColumn'
  return 'Panel'
}

export function ginyPrimitiveFromType(type: string | undefined, name?: string, flexDirection?: string): GinyPrimitive {
  return ginyPrimitive({
    type,
    name,
    binding: name,
    style: flexDirection ? { 'flex-direction': flexDirection } : undefined,
  })
}

/** Fold UITK chrome and grid cells into Giny primitives. Inner VisualElements
    that only exist so USS can paint a Slot stay out of the AST. */
export function normalizeGiny(node: VisualTreeNode, ctx: { tree?: string; path?: string } = {}): GinyNode {
  const tree = ctx.tree ?? node.asset
  const name = nodeName(node)
  const path = joinPath(ctx.path, name)
  const component = ginyPrimitive(node)
  const sprite = firstSprite(node)
  const slice = nineSlice(node.style)
  let visual = sprite || slice || node.style?.color || node.style?.['background-color']
    ? {
        sprite,
        color: node.style?.['unity-background-image-tint-color'] ?? node.style?.['background-color'] ?? node.style?.color,
        nineSlice: slice,
      }
    : undefined
  if (component === 'Window') {
    const chrome = (node.children ?? []).find((child) => nodeName(child) === 'window_background')
    if (chrome) {
      visual = {
        sprite: firstSprite(chrome),
        color: chrome.style?.['unity-background-image-tint-color'] ?? chrome.style?.['background-color'],
        nineSlice: nineSlice(chrome.style),
      }
    }
  }
  const source: GinySource = {
    tree,
    path: path || name || component,
    name: name || undefined,
    type: node.type,
    fullType: node.full_type,
    id: node.id,
    classes: node.classes ?? [],
    sprite,
  }
  const nextCtx = { tree, path }
  let children: GinyNode[]
  if (component === 'Window') children = windowChildren(node, nextCtx)
  else if (component === 'ItemGrid') children = gridChildren(node, nextCtx)
  else if (component === 'ItemSlot') children = []
  else children = (node.children ?? []).map((child) => normalizeGiny(child, nextCtx))
  return {
    component,
    name: name || undefined,
    text: typeof node.text === 'string' && node.text ? node.text : undefined,
    layout: layoutFacts(node.style),
    visual,
    source,
    children,
  }
}

export function ginySize(node: GinyNode): number {
  return 1 + node.children.reduce((sum, child) => sum + ginySize(child), 0)
}

export function findGiny(node: GinyNode, component: GinyPrimitive): GinyNode[] {
  const found = node.component === component ? [node] : []
  for (const child of node.children) found.push(...findGiny(child, component))
  return found
}

export function nineSlice(style?: Record<string, unknown>): [number, number, number, number] | undefined {
  if (!style) return undefined
  const keys = ['unity-slice-left', 'unity-slice-bottom', 'unity-slice-right', 'unity-slice-top'] as const
  const values = keys.map((key) => layoutNumber(style[key]))
  if (values.every((value) => value == null || value === 0)) return undefined
  return values.map((value) => value ?? 0) as [number, number, number, number]
}

export function layoutFacts(style?: Record<string, unknown>): GinyLayout {
  if (!style) return {}
  const layout: GinyLayout = {}
  for (const key of LAYOUT_KEYS) {
    if (style[key] != null) layout[key] = style[key]
  }
  return layout
}

function windowChildren(node: VisualTreeNode, ctx: { tree?: string; path?: string }): GinyNode[] {
  const out: GinyNode[] = []
  for (const child of node.children ?? []) {
    const name = nodeName(child)
    if (WINDOW_CHROME.has(name)) continue
    if (name === WINDOW_BODY) {
      for (const inner of child.children ?? []) out.push(normalizeGiny(inner, { ...ctx, path: joinPath(ctx.path, name) }))
      continue
    }
    out.push(normalizeGiny(child, ctx))
  }
  return out
}

function gridChildren(node: VisualTreeNode, ctx: { tree?: string; path?: string }): GinyNode[] {
  return (node.children ?? []).map((cell) => {
    const slot = findDescendant(cell, (candidate) => SLOT_TYPES.has(candidate.type ?? '')) ?? cell
    return normalizeGiny({ ...slot, type: slot.type && SLOT_TYPES.has(slot.type) ? slot.type : 'Slot' }, ctx)
  })
}

function firstSprite(node: VisualTreeNode): string | undefined {
  if (typeof node.sprite === 'string' && node.sprite) return node.sprite
  const image = node.style?.['background-image']
  if (typeof image === 'string' && image) return image
  for (const child of node.children ?? []) {
    const nested = firstSprite(child)
    if (nested) return nested
  }
  return undefined
}

function findDescendant(node: VisualTreeNode, match: (node: VisualTreeNode) => boolean): VisualTreeNode | undefined {
  if (match(node)) return node
  for (const child of node.children ?? []) {
    const found = findDescendant(child, match)
    if (found) return found
  }
  return undefined
}

function nodeName(node: VisualTreeNode): string {
  return (node.binding || node.name || '').trim()
}

function joinPath(prefix: string | undefined, name: string): string {
  if (!name) return prefix ?? ''
  return prefix ? `${prefix}/${name}` : name
}

function layoutNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value && typeof value === 'object' && 'value' in value) {
    const inner = (value as { value: unknown }).value
    if (typeof inner === 'number' && Number.isFinite(inner)) return inner
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}
