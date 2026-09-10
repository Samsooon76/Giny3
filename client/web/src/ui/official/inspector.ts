import { elementPaint, layoutOffset } from './dumpBoxes'
import { ginyPrimitiveFromType } from './patterns'

/** Primitives worth pinning. A click on `toggle_container` (Panel) walks up
    to `btnAll` (Button) so a paste to the agent names the component, not the
    adapter interior. */
const HOST_PRIMITIVES = new Set([
  'Window', 'Header', 'Button', 'Toggle', 'ItemGrid', 'ItemSlot',
  'ScrollView', 'TextInput', 'Dropdown', 'Image', 'Progress', 'Entity', 'Text',
])

const DROP_CLASS = /^(official-node|official-|has-background$|is-clickable$|is-hoverable$|is-interactive$|is-open$)/
const CHROME_BINDINGS = ['window_background', 'window_shadow', 'toggle_icon_Vector', 'itemTile_icon_Vector', 'itemTile_icon']

export type InspectFacts = {
  path: string
  tree: string
  type: string
  fullType: string
  giny: string
  id: string
  sprite: string
  slice: string
  classes: string[]
}

export type InspectPayload = InspectFacts & {
  box: { x: number; y: number; w: number; h: number }
  rect: { x: number; y: number; w: number; h: number }
  paint: string
  host?: InspectFacts
}

export type Inspectable = {
  getAttribute(name: string): string | null
  className?: string | { toString(): string }
  classList?: { contains(name: string): boolean }
  parentElement: Inspectable | null
  getBoundingClientRect?: () => { left: number; top: number; width: number; height: number }
  querySelector?: (selector: string) => Inspectable | null
  offsetWidth?: number
  offsetHeight?: number
}

const NODE_CLASS = 'official-node'

export function inspectEnabled(search = typeof location === 'undefined' ? '' : location.search): boolean {
  return new URLSearchParams(search).get('ui-inspect') === '1'
}

export function officialPath(start: Inspectable | null): string {
  const parts: string[] = []
  let node = start
  while (node) {
    if (isOfficialNode(node)) {
      const name = node.getAttribute('data-binding') || node.getAttribute('data-type')
      if (name) parts.push(name)
    }
    node = node.parentElement
  }
  return parts.reverse().join('/')
}

export function inspectPayload(element: Inspectable): InspectPayload {
  const hit = facts(element)
  const hostNode = hostElement(element)
  const host = hostNode !== element ? facts(hostNode) : undefined
  const painted = paintOf(element) || (hostNode !== element ? paintOf(hostNode) : '') || chromeSprite(hostNode).sprite
  const chrome = !hit.sprite ? chromeSprite(hostNode) : { sprite: '', slice: '', from: '' }
  const box = canvasBox(element)
  const rect = element.getBoundingClientRect?.() ?? { left: 0, top: 0, width: box.w, height: box.h }
  return {
    ...hit,
    sprite: hit.sprite || chrome.sprite,
    slice: hit.slice || chrome.slice,
    paint: fileName(painted),
    box,
    rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
    host,
  }
}

/** Plain text the player pastes back. Keep the labels stable — they are the
    contract with the next debugging turn. */
export function formatInspectDump(payload: InspectPayload): string {
  const lines = [
    `chemin    ${payload.path || '—'}`,
    `source    ${payload.tree ? `${payload.tree}.uxml` : '—'}`,
    `type      ${payload.fullType || payload.type || '—'}`,
    `giny      ${payload.giny || '—'}`,
    `id        ${payload.id || '—'}`,
    `box       ${payload.box.w}×${payload.box.h} @ ${payload.box.x},${payload.box.y}`,
    `sprite    ${payload.sprite || payload.paint || '—'}`,
  ]
  if (payload.slice) lines.push(`slice     ${payload.slice}`)
  if (payload.classes.length) lines.push(`classes   ${payload.classes.join(' ')}`)
  if (payload.host) {
    lines.push(`hôte      ${payload.host.path}`)
    lines.push(`hôte-type ${payload.host.fullType || payload.host.type} · ${payload.host.giny}`)
    if (payload.host.id) lines.push(`hôte-id   ${payload.host.id}`)
    if (payload.host.sprite) lines.push(`hôte-sprite ${payload.host.sprite}`)
  }
  return lines.join('\n')
}

export function hitOfficialNode(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null
  return target.closest(`.${NODE_CLASS}`)
}

function facts(element: Inspectable): InspectFacts {
  const type = element.getAttribute('data-type') || 'VisualElement'
  const name = element.getAttribute('data-binding') || undefined
  const chrome = chromeSprite(element)
  return {
    path: officialPath(element),
    tree: closestAttr(element, 'data-tree') || '',
    type,
    fullType: element.getAttribute('data-full-type') || '',
    giny: element.getAttribute('data-giny') || ginyPrimitiveFromType(type, name),
    id: element.getAttribute('data-unity-id') || '',
    sprite: element.getAttribute('data-sprite') || chrome.sprite,
    slice: element.getAttribute('data-slice') || chrome.slice,
    classes: authoredClasses(element),
  }
}

function hostElement(start: Inspectable): Inspectable {
  let node: Inspectable | null = start
  let fallback = start
  while (node) {
    if (isOfficialNode(node)) {
      fallback = node
      const giny = node.getAttribute('data-giny') || ''
      if (HOST_PRIMITIVES.has(giny)) return node
    }
    node = node.parentElement
  }
  return fallback
}

function chromeSprite(element: Inspectable): { sprite: string; slice: string; from: string } {
  if (!element.querySelector) return { sprite: '', slice: '', from: '' }
  for (const binding of CHROME_BINDINGS) {
    const child = element.querySelector(`[data-binding="${binding}"]`)
    const sprite = child?.getAttribute('data-sprite') || ''
    if (!child || !sprite) continue
    return { sprite, slice: child.getAttribute('data-slice') || '', from: binding }
  }
  return { sprite: '', slice: '', from: '' }
}

function isHtmlElement(element: Inspectable): element is Inspectable & HTMLElement {
  return typeof HTMLElement !== 'undefined' && element instanceof HTMLElement
}

function canvasBox(element: Inspectable): { x: number; y: number; w: number; h: number } {
  if (isHtmlElement(element)) {
    const surface = element.closest('.official-canvas, .official-tree-host') as HTMLElement | null
    const w = element.offsetWidth
    const h = element.offsetHeight
    if (!surface) return { x: element.offsetLeft, y: element.offsetTop, w, h }
    const [x, y] = layoutOffset(element, surface)
    return { x, y, w, h }
  }
  const rect = element.getBoundingClientRect?.()
  return {
    x: Math.round(rect?.left ?? 0),
    y: Math.round(rect?.top ?? 0),
    w: Math.round(rect?.width ?? element.offsetWidth ?? 0),
    h: Math.round(rect?.height ?? element.offsetHeight ?? 0),
  }
}

function paintOf(element: Inspectable): string {
  if (isHtmlElement(element)) return fileName(elementPaint(element) ?? '')
  return ''
}

function authoredClasses(element: Inspectable): string[] {
  return String(element.className ?? '').split(/\s+/).filter((item) => item && !DROP_CLASS.test(item))
}

function fileName(value: string): string {
  const match = /(?:url\(["']?)?([^"')]+)/.exec(value)
  const path = match?.[1] ?? value
  const file = path.split('/').pop() ?? path
  return file.replace(/["')]+$/, '')
}

function isOfficialNode(node: Inspectable): boolean {
  if (node.classList?.contains(NODE_CLASS)) return true
  return String(node.className ?? '').split(/\s+/).includes(NODE_CLASS)
}

function closestAttr(start: Inspectable, name: string): string {
  let node: Inspectable | null = start
  while (node) {
    const value = node.getAttribute(name)
    if (value) return value
    node = node.parentElement
  }
  return ''
}
