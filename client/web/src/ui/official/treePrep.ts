import { withBubbleCombatControls } from './combatControls'
import type { VisualTreeNode } from './types'
import { stampFigmaHeaders } from './windowHeaders'

function named(node: VisualTreeNode): string {
  return node.binding ?? node.name ?? ''
}

/** Reveal a tree's UXML document root.

    246 of the 672 extracted trees ship their root as `display: none` — login,
    the game menu and the character header among them. Showing it is what the
    official client does when it mounts the document, and it must not be
    confused with the elements inside that are deliberately hidden. */
export function mounted(node: VisualTreeNode): VisualTreeNode {
  if (String(node.style?.display ?? '').toLowerCase() !== 'none') return node
  return { ...node, style: { ...node.style, display: 'flex' } }
}

/** C# rest pose for a full-bleed bar whose UXML still holds the tween start.

    ServerSelection names ``m_tweenHeader`` / ``TransitionDuration`` in IL2CPP.
    The authored start is ``position: relative; width: 100%; top: -height``.
    UITK's initial ``top`` is 0 — that is the rest the tween lands on, not a
    value sampled from a screenshot. Nested ``display: none`` is left alone. */
export function atRest(node: VisualTreeNode): VisualTreeNode {
  const style = node.style ?? {}
  const nextStyle = isSlideInStart(style) ? { ...style, top: 0 } : style
  const walked = normalizeGapMargins({ ...node, children: node.children?.map(atRest) }).children
  const dropdownParts = (children: VisualTreeNode[] | undefined): VisualTreeNode[] | undefined => children?.map(child => {
    const name = named(child)
    const next = { ...child, children: dropdownParts(child.children) }
    if (name === 'dropdown_caption') return { ...next, style: { ...next.style, 'flex-grow': 1, 'flex-basis': 0 } }
    if (name === 'dropdown_captionLabel') return { ...next, style: { ...next.style, 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' } }
    if (name === 'dropdown_chevron_Vector' && !child.sprite) return { ...next, sprite: 'chevronBottom' }
    if (name === 'dropdown_choice' && !slotPainted(child)) return withDisplay(next, 'none')
    return next
  })
  const collapsed = node.type === 'TextInput' ? emptyTextInput(walked)
    : node.type === 'Dropdown' ? dropdownParts(walked) : walked
  const sameChildren = !collapsed || collapsed.every((child, index) => child === node.children?.[index])
  if (nextStyle === style && sameChildren) return node
  return { ...node, style: nextStyle, ...(collapsed ? { children: collapsed } : {}) }
}

/** An empty Figma TextInput shows ``m_placeholderLabel`` and hides the value
    layers. USS sizes placeholder / text / userText all at 100% of a row; if
    they stay in flow they shrink to 56px columns. Unity's own TextField keeps
    the placeholder until there is a value (``hidePlaceholderOnFocus``). */
function emptyTextInput(children: VisualTreeNode[] | undefined): VisualTreeNode[] | undefined {
  if (!children?.length) return children
  const filled = hasUserText(children)
  let changed = false
  const next = children.map((child) => {
    const name = child.binding ?? child.name ?? ''
    const hide = name === 'textInput_placeholder' ? filled
      : name === 'textInput_text' || name === 'textInput_userText' ? !filled
        : false
    const restyle = hide ? withDisplay(child, 'none') : child
    const inner = emptyTextInput(restyle.children)
    if (inner === child.children && restyle === child) return child
    changed = true
    return inner === restyle.children ? restyle : { ...restyle, children: inner }
  })
  return changed ? next : children
}

function hasUserText(nodes: VisualTreeNode[]): boolean {
  for (const node of nodes) {
    const name = node.binding ?? node.name ?? ''
    if (name === 'textInput_userText' || name === 'textInput_text') {
      if (String(node.text ?? node.properties?.text ?? '').trim()) return true
    }
    if (node.children && hasUserText(node.children)) return true
  }
  return false
}

function withDisplay(node: VisualTreeNode, display: string): VisualTreeNode {
  if (node.style?.display === display) return node
  return { ...node, style: { ...node.style, display } }
}

export function prepared(node: VisualTreeNode): VisualTreeNode {
  node = withCreationSpellWindow(withBubbleCombatControls(node))
  return stampFigmaHeaders(stampTextInputIcons(atRest(mounted(sizeSecondaryXLargeToggles(applyContentVariantSlots(applyToggleGroupVariants(hideRuntimeBadges(node))))))))
}

/** C# `DofusButtonCustom` / `DofusToggleButtonCustom` hide unused interior
    slots from the content variant (`icon` / `text` / `textIcon` / `asset`).

    The UXML always ships `#button_iconLeft` + `#button_iconRight` as 20×20
    flex items. Icon-only buttons leave the right slot empty, so a centered
    row of `[icon][empty 20px]` paints the glyph left of the square — the
    cog, shutdown, sendLeft, and every other icon button in the HUD. */
const BUTTON_SLOT_HOSTS = new Set(['DofusButtonCustom', 'Button'])
const TOGGLE_SLOT_HOSTS = new Set(['DofusToggleButtonCustom'])
const CONTENT_KIND = ['textIcon', 'textAsset', 'asset', 'icon', 'text'] as const
type ContentKind = (typeof CONTENT_KIND)[number]

function contentKind(classes: string[]): ContentKind | undefined {
  if (classes.includes('text') && classes.includes('icon') && !classes.includes('textIcon')) return 'textIcon'
  return CONTENT_KIND.find((kind) => classes.includes(kind))
}

function iconOnRight(properties?: Record<string, unknown>): boolean {
  return String(properties?.['icon-position'] ?? properties?.iconPosition ?? '').toLowerCase() === 'right'
}

function slotPainted(node: VisualTreeNode): boolean {
  if (typeof node.sprite === 'string' && node.sprite && node.sprite.toLowerCase() !== 'none') return true
  const text = node.text ?? node.properties?.text ?? node.properties?.['button-text']
  if (typeof text === 'string' && text.trim() && text.trim() !== '[]') return true
  return (node.children ?? []).some(slotPainted)
}

function hideIfUnpainted(node: VisualTreeNode): VisualTreeNode {
  if (String(node.style?.display).toLowerCase() === 'none' || slotPainted(node)) return node
  return withDisplay(node, 'none')
}

function takeSprite(node: VisualTreeNode, id: string): { node: VisualTreeNode; sprite?: string } {
  let sprite: string | undefined
  const visit = (current: VisualTreeNode): VisualTreeNode => {
    const name = named(current)
    let next = current
    if (name === id && typeof current.sprite === 'string' && current.sprite) {
      sprite ??= current.sprite
      next = { ...current, sprite: undefined }
    }
    const children = next.children?.map(visit)
    if (!children || children.every((child, index) => child === next.children?.[index])) return next
    return { ...next, children }
  }
  return { node: visit(node), sprite }
}

function putSprite(node: VisualTreeNode, id: string, sprite: string): VisualTreeNode {
  let placed = false
  const visit = (current: VisualTreeNode): VisualTreeNode => {
    if (placed) return current
    if (named(current) === id) {
      placed = true
      return current.sprite === sprite ? current : { ...current, sprite }
    }
    const children = current.children?.map(visit)
    if (!children || children.every((child, index) => child === current.children?.[index])) return current
    return { ...current, children }
  }
  return visit(node)
}

function hideNamedSlots(node: VisualTreeNode, hide: ReadonlySet<string>, nested = false): VisualTreeNode {
  const type = node.type ?? ''
  if (nested && (BUTTON_SLOT_HOSTS.has(type) || TOGGLE_SLOT_HOSTS.has(type))) return node
  const name = named(node)
  const children = node.children?.map((child) => hideNamedSlots(child, hide, true))
  const next = children && children.some((child, index) => child !== node.children?.[index])
    ? { ...node, children }
    : node
  return hide.has(name) ? hideIfUnpainted(next) : next
}

function applyHostContentSlots(node: VisualTreeNode): VisualTreeNode {
  const type = node.type ?? ''
  const classes = node.classes ?? []
  const kind = contentKind(classes)
  if (!kind) return node
  const right = iconOnRight(node.properties)
  const hide = new Set<string>()
  if (BUTTON_SLOT_HOSTS.has(type)) {
    const showLabel = kind === 'text' || kind === 'textIcon' || kind === 'textAsset'
    const showIcon = kind === 'icon' || kind === 'textIcon'
    const showAsset = kind === 'asset' || kind === 'textAsset'
    if (!showLabel) hide.add('button_label')
    if (!showIcon || right) hide.add('button_iconLeft')
    if (!showIcon || !right) hide.add('button_iconRight')
    if (!showAsset) {
      hide.add('button_assetLeft')
      hide.add('button_assetRight')
    }
    const icon = node.properties?.['icon-value']
    let next = showIcon && typeof icon === 'string' && !/^\d+$/.test(icon)
      ? putSprite(node, right ? 'button_iconRight_Vector' : 'button_iconLeft_Vector', icon) : node
    if (showIcon && right) {
      const taken = takeSprite(next, 'button_iconLeft_Vector')
      next = taken.node
      if (taken.sprite) next = putSprite(next, 'button_iconRight_Vector', taken.sprite)
    }
    return hideNamedSlots(next, hide)
  }
  if (TOGGLE_SLOT_HOSTS.has(type)) {
    const showLabel = kind === 'text' || kind === 'textIcon'
    const showIcon = kind === 'icon' || kind === 'textIcon'
    const showAsset = kind === 'asset' || kind === 'textAsset'
    if (!showLabel) hide.add('toggle_label')
    if (!showIcon) hide.add('toggle_icon')
    if (!showAsset) hide.add('toggle_asset')
    const icon = node.properties?.['icon-value']
    const next = showIcon && typeof icon === 'string' && !/^\d+$/.test(icon)
      ? putSprite(node, 'toggle_icon_Vector', icon) : node
    return hideNamedSlots(next, hide)
  }
  return node
}

export function applyContentVariantSlots(node: VisualTreeNode): VisualTreeNode {
  const iconType = node.properties?.['icon-type']
  if (iconType === 'Icon' && node.properties?.['icon-value']) node = { ...node, classes: [...(node.classes ?? []).filter(c => c !== 'asset' && c !== 'textAsset'), 'icon'] }
  const slotted = applyHostContentSlots(node)
  const children = slotted.children?.map(applyContentVariantSlots)
  if (!children || children.every((child, index) => child === slotted.children?.[index])) return slotted
  return { ...slotted, children }
}

/** UXML ``icon=magnifier`` / ``kamas`` paints Figma ``#textInput_iconLeft``.

    Cached trees skip the extractor inject when content already exists. Nest
    the 20×20 slot inside ``#textInput_content`` (USS row + border). Do not
    put the sprite on the 260×32 host. */
export function stampTextInputIcons(node: VisualTreeNode): VisualTreeNode {
  const host = node.type === 'TextInput' ? withTextInputIcon(node) : node
  const children = host.children?.map(stampTextInputIcons)
  if (!children) return host
  if (host === node && children.every((child, index) => child === node.children?.[index])) return node
  return { ...host, children }
}

function textInputIcon(node: VisualTreeNode): string | undefined {
  const raw = String(node.properties?.icon ?? '').trim()
  if (!raw || ['none', 'true', 'false'].includes(raw.toLowerCase()) || /^\d+$/.test(raw)) return undefined
  return raw
}

function isTextInputIconLeft(node: VisualTreeNode): boolean {
  return named(node) === 'textInput_iconLeft'
}

function withTextInputIcon(node: VisualTreeNode): VisualTreeNode {
  const icon = textInputIcon(node)
  if (!icon) return node
  const kids = node.children ?? []
  if (kids.some(isTextInputIconLeft) || kids.some((child) => (child.children ?? []).some(isTextInputIconLeft))) {
    return fillTextInputIconSprite(node, icon)
  }
  const slot = textInputIconSlot(icon)
  const contentAt = kids.findIndex((child) => named(child) === 'textInput_content')
  if (contentAt < 0) return { ...node, children: [slot, ...kids] }
  const content = kids[contentAt]
  const next = [...kids]
  next[contentAt] = { ...content, children: [slot, ...(content.children ?? [])] }
  return { ...node, children: next }
}

function textInputIconSlot(icon: string): VisualTreeNode {
  const kamas = /(?:^|\/)kamas(?:\.png)?$/i.test(icon)
  const vector: VisualTreeNode = {
    name: 'textInput_iconLeft_Vector',
    binding: 'textInput_iconLeft_Vector',
    type: 'VisualElement',
    properties: { name: 'textInput_iconLeft_Vector' },
    children: kamas ? [{
      name: 'textInput_iconLeft_Vector_Kamas',
      binding: 'textInput_iconLeft_Vector_Kamas',
      type: 'VisualElement',
      properties: { name: 'textInput_iconLeft_Vector_Kamas' },
      children: [],
      sprite: icon,
    }] : [],
    ...(kamas ? {} : { sprite: icon }),
  }
  return {
    name: 'textInput_iconLeft',
    binding: 'textInput_iconLeft',
    type: 'VisualElement',
    properties: { name: 'textInput_iconLeft' },
    children: [vector],
  }
}

function fillTextInputIconSprite(node: VisualTreeNode, icon: string): VisualTreeNode {
  let changed = false
  const kamas = /(?:^|\/)kamas(?:\.png)?$/i.test(icon)
  const visit = (current: VisualTreeNode): VisualTreeNode => {
    const id = named(current)
    const kids = current.children?.map(visit)
    let next = current
    if (kamas && id === 'textInput_iconLeft_Vector_Kamas' && !current.sprite) {
      next = { ...current, sprite: icon }
      changed = true
    }
    if (!kamas && id === 'textInput_iconLeft_Vector' && !current.sprite && !(current.children?.length)) {
      next = { ...current, sprite: icon }
      changed = true
    }
    if (kids && (!current.children || kids.some((child, index) => child !== current.children?.[index]))) {
      changed = true
      next = { ...next, children: kids }
    }
    return next
  }
  const filled = visit(node)
  return changed ? filled : node
}

/** C# notification dots. USS paints them always (``.toggle #toggle_indicatorCircle``
    is a 10px highlight); the constructor only shows one when a category has
    something new. Without live notification data they stay off. */
const RUNTIME_BADGES = new Set(['toggle_indicatorCircle', 'tab_indicatorCircle'])

export function hideRuntimeBadges(node: VisualTreeNode): VisualTreeNode {
  const name = node.binding ?? node.name ?? ''
  const children = node.children?.map(hideRuntimeBadges)
  const sameChildren = !children || children.every((child, index) => child === node.children?.[index])
  const hide = RUNTIME_BADGES.has(name) && String(node.style?.display ?? '').toLowerCase() !== 'none'
  if (!hide && sameChildren) return node
  return {
    ...node,
    ...(hide ? { style: { ...node.style, display: 'none' } } : {}),
    ...(sameChildren ? {} : { children }),
  }
}

/** UXML authors ``main-style`` / ``toggle-size`` on ``DofusToggleButtonGroupCustom``.
    Child ``DofusToggleButtonCustom`` instances omit those attributes, so the
    extractor defaults them to ``secondary`` / ``small``. C#
    ``RefreshGroup`` + ``get/set_toggleSize`` live on the buttons; the group's
    authored values are what the children would resolve to. ``.toggle.primary.large.normal.icon``
    is the 32×32 USS rule ``spellBase`` ``tgl_group`` needs. */
const TOGGLE_MAINS = new Set(['primary', 'secondary', 'tertiary'])
const TOGGLE_SIZES = new Set(['small', 'medium', 'large', 'xLarge', 'xxLarge', 'huge'])

function authoredToggleMain(properties?: Record<string, unknown>): string | undefined {
  const named = String(properties?.['main-style'] ?? '')
  return TOGGLE_MAINS.has(named) ? named : undefined
}

function authoredToggleSize(properties?: Record<string, unknown>): string | undefined {
  const named = String(properties?.['toggle-size'] ?? '')
  return TOGGLE_SIZES.has(named) ? named : undefined
}

function swapToggleClass(classes: string[], from: string | undefined, to: string | undefined): string[] {
  if (!to) return classes
  if (!from || from === to) return classes.includes(to) ? classes : [...classes, to]
  let swapped = false
  const next = classes.map((value) => {
    if (value !== from) return value
    swapped = true
    return to
  })
  return swapped ? next : [...next, to]
}

export function applyToggleGroupVariants(node: VisualTreeNode): VisualTreeNode {
  const walked = node.children?.map(applyToggleGroupVariants)
  const isGroup = node.type === 'DofusToggleButtonGroupCustom'
  const main = isGroup ? authoredToggleMain(node.properties) : undefined
  const size = isGroup ? authoredToggleSize(node.properties) : undefined
  let classes = node.classes ?? []
  if (isGroup) {
    if (main && !classes.includes(main)) classes = [...classes, main]
    if (size && !classes.includes(size)) classes = [...classes, size]
  }
  const children = isGroup && (main || size) && walked
    ? walked.map((child) => stampToggleFromGroup(child, main, size))
    : walked
  const sameClasses = classes.length === (node.classes?.length ?? 0)
    && classes.every((value, index) => value === node.classes?.[index])
  const sameChildren = !children || children.every((child, index) => child === node.children?.[index])
  if (sameClasses && sameChildren) return node
  return {
    ...node,
    ...(sameClasses ? {} : { classes }),
    ...(sameChildren ? {} : { children }),
  }
}

function stampToggleFromGroup(
  child: VisualTreeNode,
  main: string | undefined,
  size: string | undefined,
): VisualTreeNode {
  if (child.type !== 'DofusToggleButtonCustom') return child
  const props = child.properties ?? {}
  let classes = child.classes ?? []
  if (main && !authoredToggleMain(props)) {
    const current = classes.find((value) => TOGGLE_MAINS.has(value))
    classes = swapToggleClass(classes, current, main)
  }
  if (size && !authoredToggleSize(props) && !props.size) {
    const current = classes.find((value) => TOGGLE_SIZES.has(value))
    classes = swapToggleClass(classes, current, size)
  }
  const same = classes.length === (child.classes?.length ?? 0)
    && classes.every((value, index) => value === child.classes?.[index])
  return same ? child : { ...child, classes }
}

/** Official USS has no ``.toggle.secondary.xLarge``. Inventory categories
    still author that size; the large rule is 32×32. Use a 40px fallback for xLarge, matching the
    reference's 48px tabs at 120% scale. Extracted trees
    baked the missing width in, so the client fills it or the rail is 8px. */
const SECONDARY_XLARGE_PX = { value: 40, unit: 'px' }
const FILL = { value: 100, unit: '%' }
const TOGGLE_ART = /^(toggle_container|toggle_icon|toggle_icon_Vector|toggle_asset|toggle_asset_asset)$/

export function sizeSecondaryXLargeToggles(node: VisualTreeNode): VisualTreeNode {
  const classes = node.classes ?? []
  const isToggle = (node.type === 'DofusToggleButtonCustom' || classes.includes('toggle'))
    && classes.includes('secondary') && classes.includes('xLarge')
  let next = node
  if (isToggle && (node.style?.width == null || Number((node.style.width as { value?: number })?.value ?? node.style.width) === 32)) {
    next = {
      ...node,
      style: {
        ...node.style,
        width: SECONDARY_XLARGE_PX,
        height: SECONDARY_XLARGE_PX,
        'flex-shrink': 0,
      },
    }
  }
  const children = (next.children ?? []).map((child) => {
    const sized = sizeSecondaryXLargeToggles(child)
    return isToggle ? fillToggleArt(sized) : sized
  })
  const same = children.length === (next.children?.length ?? 0)
    && children.every((child, index) => child === next.children?.[index])
  if (same && next === node) return node
  return same ? next : { ...next, children }
}

function fillToggleArt(node: VisualTreeNode): VisualTreeNode {
  const name = node.binding ?? node.name ?? ''
  const inner = (node.children ?? []).map(fillToggleArt)
  const sameInner = inner.length === (node.children?.length ?? 0)
    && inner.every((child, index) => child === node.children?.[index])
  if (!TOGGLE_ART.test(name)) {
    return sameInner ? node : { ...node, children: inner }
  }
  const style = node.style ?? {}
  const filled: Record<string, unknown> = {
    ...style,
    width: style.width ?? FILL,
    height: style.height ?? FILL,
  }
  // The extracted UXML gives the icon a 100% width and height, but UITK's
  // default background mode is stretch. Category sprites are square canvases
  // with different transparent padding, so stretching them into the button
  // rect makes some icons visibly flat. Keep the square canvas and fit it.
  if (name === 'toggle_icon_Vector' && style['unity-background-scale'] == null) {
    filled['unity-background-scale'] = 'scale-to-fit'
  }
  if (filled === style && sameInner) return node
  return { ...node, style: filled, children: sameInner ? node.children : inner }
}

/** A bound TextInput shows only ``#textInput_userText``. USS sizes placeholder,
    text and userText at 100% of a row: if they stay in flow they split the
    field. C# hides the unused layers; it does not absolutely-position them. */
export function withLiveTextInput(children: VisualTreeNode[] | undefined, value: string): VisualTreeNode[] | undefined {
  if (!children?.length) return children
  let changed = false
  const next = children.map((child) => {
    const name = child.binding ?? child.name ?? ''
    const hide = name === 'textInput_placeholder' || name === 'textInput_text'
    const restyle = hide ? withDisplay(child, 'none')
      : name === 'textInput_userText' ? { ...withDisplay(child, 'flex'), text: value }
        : child
    const inner = withLiveTextInput(restyle.children, value)
    if (inner === child.children && restyle === child) return child
    changed = true
    return inner === restyle.children ? restyle : { ...restyle, children: inner }
  })
  return changed ? next : children
}

/** C# `element.style.display = DisplayStyle.Flex` when a screen shows a node.

    USS often ships that node as `display: none`, and hover/disabled states
    compile the same property into a stylesheet rule. Checking whether the
    *inline* style is already `none` misses those, so the reveal has to be
    unconditional. */
export function applyBindingVisibility(style: { display?: unknown }, hidden?: boolean): void {
  if (hidden === false) style.display = 'flex'
}

/** USS/UXML size that keeps a host in layout even when every child is hidden. */
export function hasAuthoredSize(style?: Record<string, unknown>): boolean {
  if (!style) return false
  for (const key of ['width', 'height', 'min-width', 'min-height'] as const) {
    const dim = length(style[key])
    if (dim.px != null || dim.percent != null) return true
  }
  return false
}

/** C# rest: a host with no authored size whose children are all hidden (or
    themselves collapsed) is `DisplayStyle.None` — it does not leave a 12px
    filled square. MapInfo's fight/haven toolbar is that host: USS paints
    `--background_medium90` on an unnamed DofusVE, and `UpdateContextualOptions`
    hides the whole bar out of those contexts. Rank sampled it as a 16×16
    `backgroundColor_background_medium90` square on 11 HUD screens. */
export function collapsedByHiddenChildren(
  node: VisualTreeNode,
  hidden: (node: VisualTreeNode) => boolean,
): boolean {
  if (hasAuthoredSize(node.style) || Boolean(node.text)) return false
  const children = node.children ?? []
  if (!children.length) return false
  return children.every((child) => hidden(child) || collapsedByHiddenChildren(child, hidden))
}

/** Login's `ctr_login` hides the official play/port children and injects the
    credential form. That host is not leftover empty chrome. */
export function collapsesUnpaintedHost(
  node: VisualTreeNode,
  hidden: (node: VisualTreeNode) => boolean,
  override?: { hidden?: boolean; replaceChildren?: boolean; children?: unknown },
): boolean {
  if (override?.hidden) return true
  if (override?.hidden === false || override?.replaceChildren || override?.children != null) return false
  return collapsedByHiddenChildren(node, hidden)
}

function isSlideInStart(style: Record<string, unknown>): boolean {
  const position = String(style.position ?? 'relative').toLowerCase()
  if (position !== 'relative') return false
  if (length(style.width).percent !== 100) return false
  const top = length(style.top).px
  const height = length(style.height).px
  return top != null && height != null && top < 0 && -top >= height
}

function length(value: unknown): { px?: number; percent?: number } {
  if (typeof value === 'number' && Number.isFinite(value)) return { px: value }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.endsWith('%')) {
      const n = Number.parseFloat(trimmed)
      return Number.isFinite(n) ? { percent: n } : {}
    }
    const n = Number.parseFloat(trimmed)
    return Number.isFinite(n) ? { px: n } : {}
  }
  if (!value || typeof value !== 'object' || !('value' in value)) return {}
  const amount = Number((value as { value: unknown }).value)
  if (!Number.isFinite(amount)) return {}
  const unit = String((value as { unit?: string }).unit || 'px')
  return unit === '%' ? { percent: amount } : { px: amount }
}

/** Older exports lower USS gap into half-margins AND retain the gap property.
 * Undo only this exact duplicated gap pattern; authored unrelated margins stay. */
export function normalizeGapMargins(node: VisualTreeNode): VisualTreeNode {
  const scalar = (value: unknown): number => typeof value === 'number' ? value
    : value && typeof value === 'object' && 'value' in value ? Number(value.value) : Number(value)
  const gap = scalar(node.style?.gap ?? node.properties?.['gap-value'])
  const kids = node.children
  if (!(gap > 0) || !kids || kids.length < 2) return node
  const row = String(node.style?.['flex-direction'] ?? '').startsWith('row')
  const end = row ? 'margin-right' : 'margin-bottom'
  const start = row ? 'margin-left' : 'margin-top'
  const clear = new Map<number, Set<string>>()
  for (let i = 0; i < kids.length - 1; i++) {
    if (scalar(kids[i].style?.[end]) !== gap / 2 || scalar(kids[i + 1].style?.[start]) !== gap / 2) continue
    if (!clear.has(i)) clear.set(i, new Set())
    if (!clear.has(i + 1)) clear.set(i + 1, new Set())
    clear.get(i)!.add(end)
    clear.get(i + 1)!.add(start)
  }
  if (!clear.size) return node
  return { ...node, children: kids.map((child, index) => {
    const keys = clear.get(index)
    if (!keys) return child
    const style = { ...child.style }
    keys.forEach(key => { style[key] = 0 })
    return { ...child, style }
  }) }
}

/** Runtime creation popup chrome; the extracted tree stores a headerless editor pose. */
function withCreationSpellWindow(node: VisualTreeNode): VisualTreeNode {
  const children = node.children?.map(withCreationSpellWindow)
  if (named(node) === 'window_spells') return { ...node, children,
    properties: { ...node.properties, 'with-title-bar': 'true', title: 'Sorts de classe' },
  }
  return children ? { ...node, children } : node
}
