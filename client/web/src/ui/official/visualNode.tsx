import { Fragment, cloneElement, createContext, isValidElement, useContext, useState, type ChangeEventHandler, type CSSProperties, type KeyboardEventHandler, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref } from 'react'
import { InsideWindowContext, OfficialWindowNode, WindowLayoutContext, type WindowFrame } from './OfficialWindow'
import { canvasRectFromDom } from './surface'
import { hostSpriteName, implicitImageSize, useOfficialSprite } from './OfficialIcon'
import { prepared, applyBindingVisibility, collapsesUnpaintedHost, withLiveTextInput } from './treePrep'
import { RUNTIME_CLASSES } from './stylesheet'
import {
  isTruncated, officialUid, tooltipStore, wantsElidedTooltip,
} from './tooltipStore'
import { EntityPreview } from '../EntityPreview'
import { cascadeKeys, nodeCascadeCss, hasPointerState, splitCascade } from './cascade'
import {
  DROPDOWN_TYPES, INPUT_BINDINGS, PROGRESS_TYPES, SCROLL_TYPES, TOGGLE_TYPES,
  checkboxLineNeedsCaption, childScope, hideClosedDropdownList, initialChecked, isStatefulControl, mergeExclusiveClasses, progressColor, progressFill, progressOrientation, swapFlagClass, swapSideClass, withCheckboxLineCaption, withCheckboxState, withSwitchSide,
} from './controls'
import { applyAuthoredSingleLine, applyResolvedSprite, hasTintedBackground, ussToCss } from './uss'
import { isChromeOnlyWindow, isFlowWindow, isWindowNode } from './windowChrome'
import { menuStore } from './layoutStore'
import { ginyPrimitive, nineSlice } from './patterns'
import { EntityStatsGraphPaint } from './entityStatsGraph'
import type { BindingResolver, VisualTreeNode } from './types'
import { EMPTY_REPEATER, cloneTemplateBody, repeaterItemStyle, type Repeater } from './repeaters'
import { applyClonedStatsLayout, layoutOnlyUss, paintUss, uitkAncestry, uitkInlineClass, UitkHostContext, UitkPaintContext, inlinedHostChildren, uitkNestedTemplate } from './uitk'
import { windowFixup } from './windowFixups'
import { dividerInterior } from './divider'
import { slotInterior } from './slot'

const TEXT_TYPES = new Set(['DofusLabel', 'Label', 'Tag', 'TableColumnHeader'])
const BUTTON_TYPES = new Set([
  'PlayButton', 'DofusButtonCustom', 'DofusButton', 'DofusTab', 'DofusToggleButtonCustom',
  'Button', 'DropdownButton', 'Slot',
])
/** Toggles whose interior can hold another control (gender icons, a checkbox
    tick). A native `<button>` around those children is invalid HTML and React
    warns on the creation screen. */
const TOGGLE_HOST_TYPES = new Set([
  'CheckboxCustom', 'Checkbox', 'Switch', 'RadioButton', 'RadioButtonCustom',
])
/** Controls that receive the pointer without becoming a `<button>`. */
const INTERACTIVE_TYPES = new Set([
  ...BUTTON_TYPES, ...TOGGLE_HOST_TYPES, 'Dropdown', 'TextInput', 'Slider', 'Scroller',
  'ScrollView', 'ListView', 'ColorPickerField',
])

export const ComponentStyleContext = createContext<Record<string, Record<string, unknown>>>({})
export const OfficialTreeContext = createContext('')
const TextInputLiveContext = createContext<{
  value: string
  placeholder?: string
  onInput: ChangeEventHandler<HTMLInputElement>
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>
} | null>(null)

type VisualNodeProps = {
  node: VisualTreeNode
  resolve: BindingResolver
  scope?: string
  repeaters: Repeater
  templates: Record<string, VisualTreeNode>
  parentBinding?: string
  childIndex?: number
  ancestorIds?: string[]
  /** Placement and injected chrome for a node the window controller owns. */
  frame?: WindowFrame
  /** This node is its window's official drag surface, and carries whatever
      chrome the window's constructor puts inside it. */
  dragHandle?: { height?: number; children?: ReactNode }
  /** Placement for the UXML document root only — never inherited by children,
      including unlabeled ones, which used to share `binding === ''`. */
  rootStyle?: CSSProperties
  /** Local C# constructor state for dropdowns, toggles and gauges. */
  control?: ControlRuntime
  /** C# only shows `#dropdown_list` while `activatedTrue`. The list is nested
      under `#dropdown_content`, so filtering the Dropdown host's direct
      children never reached it — and `.official-Dropdown` missed `DropdownButton`. */
  hideDropdownList?: boolean
  /** Keep JSON sprite/9-slice paint until `/uitk/trees/{template}.css` loads.
      Namespaced `uitk-inline-{doc}-{N}` is the official paint path. */
  keepPaint?: boolean
  /** VisualTreeAsset this subtree was cloned from (`MainStatItem`, …). */
  uitkTemplate?: string
}

type ControlRuntime = {
  open: boolean
  checked: boolean
  toggleOpen: () => void
  toggleChecked: () => void
}

function chain<E>(...handlers: Array<((event: E) => void) | undefined>) {
  const active = handlers.filter(Boolean) as Array<(event: E) => void>
  if (!active.length) return undefined
  return (event: E) => { for (const handler of active) handler(event) }
}

export function VisualNode(props: VisualNodeProps): ReactNode {
  const themed = useContext(UitkHostContext)
  if (hideClosedDropdownList(!props.hideDropdownList, props.node)) return null
  const type = props.node.type ?? 'VisualElement'
  const content = !props.control && isStatefulControl(type) ? <StatefulVisualNode {...props} /> : <PaintedNode {...props} />
  // Figma constructor styles are in theme.css even when the containing UXML
  // has no sheet. Its dynamic activeTrue/secondary rules must win over the
  // compiled rest pose. Keep the document's own paint for all other nodes.
  return themed && ['DofusTab', 'DofusButtonCustom', 'Slot', 'Switch', 'CheckboxCustom', 'RadioButtonCustom'].includes(type)
    ? <UitkPaintContext value={true}>{content}</UitkPaintContext> : content
}

function StatefulVisualNode(props: VisualNodeProps) {
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState(() => initialChecked(props.node))
  return <PaintedNode
    {...props}
    control={{
      open,
      checked,
      toggleOpen: () => setOpen((value) => !value),
      toggleChecked: () => setChecked((value) => !value),
    }}
  />
}

function PaintedNode(props: VisualNodeProps): ReactNode {
  const { node, resolve, scope, repeaters, templates, parentBinding, childIndex, ancestorIds = [], frame, dragHandle, rootStyle, control, keepPaint, uitkTemplate } = props
  // One subscription-free read: the controller object is stable, so a drag
  // never re-renders trees that hold no window.
  const controller = useContext(WindowLayoutContext)
  const insideWindow = useContext(InsideWindowContext)
  const componentStyle = useContext(ComponentStyleContext)
  const treeName = useContext(OfficialTreeContext)
  const uitkPaint = useContext(UitkPaintContext)
  const type = node.type ?? 'VisualElement'
  const binding = node.binding || node.name || (
    ((type === 'Slot' || type === 'DofusTab' || type === 'DofusToggleButtonCustom') && parentBinding)
      ? `${parentBinding}:${childIndex ?? 0}`
      : ''
  )
  // A repeated cell (`<grid>:<index>`) scopes its subtree, so a caller can
  // address the part it wants inside one tile — the icon a menu entry paints in
  // its container, for instance — without every tile answering at once.
  // Official `<Instance>` hosts and `ColorPickerField` share child names
  // (`lbl_content`, `colorPickerField_color`), so they are scoped the same way.
  const nextScope = childScope(node.type, binding, scope)
  const override = resolve(binding, nextScope)
  const spriteName = hostSpriteName(node, override?.sprite)
  const inventorySlot = type === 'Slot' && (node.classes ?? []).some(name => name === 'inventory' || name === 'cosmetic')
  const interiorSprite = inventorySlot ? override?.sprite : undefined
  const spriteUrl = useOfficialSprite(
    spriteName,
    Boolean(node.properties?.hasShadow ?? node.properties?.['has-shadow']),
  )
  if (collapsesUnpaintedHost(node, (child) => {
    const childBinding = child.binding || child.name || ''
    return resolve(childBinding, childScope(child.type, childBinding, nextScope))?.hidden === true
  }, override)) return null
  // An official window is not rendered any differently — it is placed, given
  // its handle and its grips, then rendered exactly like any other node.
  if (!frame && controller && isWindowNode(node)) {
    return <OfficialWindowNode
      node={node}
      controller={controller}
      placement={isFlowWindow(node) ? 'flow' : insideWindow.nested || isChromeOnlyWindow(node) ? 'chrome' : 'canvas'}
      render={(built) => <VisualNode {...props} frame={built} />}
    />
  }
  const isText = TEXT_TYPES.has(type), isButton = BUTTON_TYPES.has(type)
  const Tag = isButton ? 'button' : isText ? 'span' : 'div'
  const uid = officialUid(treeName, scope, node.id, binding)
  // A component's own USS sits under the node's: whatever the UXML author set
  // on this instance still wins over what its constructor brings.
  const runtimeStyle = componentStyle[type]
  const authoredStyle = uitkPaint
    ? {
        ...layoutOnlyUss(runtimeStyle),
        ...layoutOnlyUss(node.style),
        ...(keepPaint ? paintUss(node.style) : {}),
      }
    : runtimeStyle
      ? { ...runtimeStyle, ...node.style }
      : node.style
  const baseStyle = uitkPaint || !runtimeStyle ? authoredStyle : { ...runtimeStyle, ...authoredStyle }
  // A window-local correction sits at the authored-USS level so the cascade,
  // the tint and the 9-slice all see it; an inline style would beat the very
  // `:hover` rules splitCascade is about to extract. See windowFixups.ts.
  const fixup = windowFixup(treeName, node.name, binding)
  const painted: VisualTreeNode = {
    ...node,
    style: fixup?.style ? { ...baseStyle, ...fixup.style } : baseStyle,
    sprite: override?.sprite ?? fixup?.sprite ?? node.sprite,
  }
  // Properties a :hover / :active / [data-state] rule redefines cannot be
  // inline: the cascade would never let those rules win.
  const { inlineUss, cssUss } = splitCascade(uitkPaint ? { ...painted, states: {}, ancestor_states: [] } : painted)
  // The defaults of whatever moved into the rule stay out of the inline style:
  // an inline declaration beats the rule that was supposed to replace it.
  const declared = new Set([...Object.keys(cssUss), ...cascadeKeys(painted)])
  const style = { ...ussToCss(inlineUss, isText, true, declared), ...rootStyle, ...override?.style, ...frame?.style }
  applyAuthoredSingleLine(style, node.properties)
  if (spriteUrl && !inventorySlot) {
    applyResolvedSprite(style, spriteUrl, painted.style)
    if (override?.style?.backgroundSize) style.backgroundSize = override.style.backgroundSize
    if (override?.style?.backgroundPosition) style.backgroundPosition = override.style.backgroundPosition
  }
  // The old extracted Slot prototype paints a legacy bitmap on its host.
  // Figma slots paint the themed container, with the object in the asset leaf.
  if (inventorySlot) {
    delete style.backgroundImage
    delete style.borderImageSource
    style.backgroundImage = 'none'
    style.padding = 2
  }
  applyBindingVisibility(style, override?.hidden)
  // A canvas WindowFigma the player opened is shown even if UI Builder left
  // the document `display: none`. Nested chrome (cartography conquest / anomaly)
  // keeps the authored rest pose — C# is what reveals those overlays.
  if (frame && style.display === 'none' && !insideWindow.nested && !isFlowWindow(node) && !isChromeOnlyWindow(node)) {
    style.display = 'flex'
  }
  // C# inserts `.header.primary` as the first in-flow child of WindowFigma.
  // The extractor still stamps `#window_content { height: 100% }` as if the
  // bar hung above the USS height; drop that so content fills the remainder.
  if (insideWindow.titleBar && (binding === 'window_content' || node.name === 'window_content')) {
    style.height = 'auto'
    style.flexGrow = 1
    style.minHeight = 0
  }
  if (dragHandle) {
    // `drag_handle-height` is the one geometry the C# constructor overrides on
    // an official handle; everything else about it is its own USS.
    if (dragHandle.height) style.height = `${dragHandle.height}px`
    style.pointerEvents = 'auto'
    style.touchAction = 'none'
  }
  const gap = node.properties?.['gap-value'] ?? node.properties?.gapValueFromEditor
  if (gap != null && style.gap == null) style.gap = `${Number.parseFloat(String(gap)) || 0}px`
  applyClonedStatsLayout(uitkTemplate, node, style)
  // A SlotGrid lays its tiles out itself: `item-size` squares wrapping in the
  // direction the grid declares. That layout is the component's, not the USS's.
  if (isTileGrid(node) && override?.repeat) {
    const direction = String(override?.style?.flexDirection ?? node.properties?.['flex-direction'] ?? '').toLowerCase()
    style.flexDirection = direction.startsWith('column') ? 'column' : 'row'
    style.flexWrap = 'wrap'
    style.alignContent = 'flex-start'
  }
  // InlineXmlGrid `flex-direction` / `item-width` live on the UXML component,
  // not in USS. Without the row axis, `gd_spellButtons` stacks 338px clones.
  if (type === 'InlineXmlGrid') applyInlineXmlGridLayout(node, style)
  if (type === 'CheckboxCustom' && (override?.text || node.classes?.includes('checkboxLine'))) { style.flexDirection = 'row'; style.alignItems = 'center'; style.gap = 8 }
  if (type === 'DofusTabGroup') { style.flexDirection = 'row'; style.alignItems = 'flex-end' }
  // The compact result uses the extracted shadow sprite and its outer insets.
  if (binding === 'window_shadow' && treeName !== 'fightResultSimple') { style.backgroundImage = 'none'; style.boxShadow = '0 10px 20px #0008'; style.inset = 0; style.borderRadius = 16; style.opacity = 0.8 }
  if (binding === 'playButton_label') { style.justifyContent = 'center'; style.alignItems = 'center' }
  // Only Image-like elements are measured from their sprite in UI Toolkit; a
  // plain VisualElement with a background image stays zero-sized. USS size,
  // including a width that ``splitCascade`` lifted into a rule, still wins
  // over the PNG's intrinsic rect.
  const spriteBox = implicitImageSize(type, painted.style, node.sprite_size)
  if (spriteBox && style.width == null && style.height == null) {
    style.width = spriteBox.width
    style.height = spriteBox.height
  }
  // EntityStatsGraph is a 1×1 UITK painter: the mesh is generated around the
  // element's origin. Without a real painter, the host still has to be large
  // enough for the SVG that bindings put inside it.
  if (type === 'EntityStatsGraph' && (parseFloat(String(style.width)) || 0) <= 2) {
    const radius = Number(node.properties?.radius ?? 80)
    const iconOffset = Number(node.properties?.['icon-offset'] ?? node.properties?.iconOffset ?? 20)
    const span = (radius + iconOffset) * 2
    style.width = `${span}px`
    style.height = `${span}px`
    style.minWidth = `${span}px`
    style.minHeight = `${span}px`
    style.overflow = 'visible'
    style.flexShrink = 0
  }
  const open = override?.open ?? control?.open ?? false
  const checked = override?.checked ?? control?.checked ?? initialChecked(node)
  if (SCROLL_TYPES.has(type)) {
    if (style.overflow == null || style.overflow === 'visible') style.overflow = 'auto'
    style.pointerEvents = 'auto'
  }
  const gaugeOrientation = PROGRESS_TYPES.has(type) ? progressOrientation(node) : 'horizontal'
  if (PROGRESS_TYPES.has(type)) {
    const fill = progressFill(node, override?.value)
    const tint = progressColor(node, override?.className)
    Object.assign(style, { ['--fill']: `${fill}%` })
    if (style.overflow == null) style.overflow = 'hidden'
    if (style.position == null || style.position === 'static') style.position = 'relative'
    if (gaugeOrientation === 'vertical') {
      style.flexDirection = 'column-reverse'
      style.alignItems = 'stretch'
    }
    if (tint) style.color = tint
  }
  if (DROPDOWN_TYPES.has(type) && open) {
    style.overflow = 'visible'
    style.zIndex = Math.max(Number(style.zIndex) || 0, 8)
  }
  let classes = [...(node.classes ?? [])]
  if (type === 'Switch') classes = swapSideClass(classes, checked)
  else if (TOGGLE_TYPES.has(type)) classes = swapFlagClass(classes, checked, 'active')
  if (DROPDOWN_TYPES.has(type)) classes = swapFlagClass(classes, open, 'activated')
  if (PROGRESS_TYPES.has(type) && gaugeOrientation === 'vertical') classes.push('is-vertical')
  classes = mergeExclusiveClasses(classes, override?.className)
  if (inventorySlot) {
    classes = mergeExclusiveClasses(classes, 'asset acquiredTrue')
    classes = swapFlagClass(classes, override?.state === 'selected', 'selected')
    if (!interiorSprite) classes.push('is-empty')
  }
  const hasBackground = node.properties?.['has-background'] === 'true' || node.properties?.hasBackground === '1' || node.properties?.hasBackground === 'true'
  // `picking-mode: Ignore` is how the official client says an element lets the
  // pointer through — the banner menu's own window does, its tiles do not.
  const ignoresPointer = String(node.properties?.['picking-mode'] ?? '').toLowerCase() === 'ignore'
  const tooltip = override?.tooltip
  const elided = wantsElidedTooltip(node)
  const widgetMenuClick = (binding === 'header_buttonRight' || binding === 'btn_settings') && insideWindow.widgetMenuId && !override?.onClick
    ? (event: ReactMouseEvent<HTMLElement>) => {
      event.stopPropagation()
      menuStore.toggle(insideWindow.widgetMenuId as string)
    }
    : undefined
  const interactive = !ignoresPointer && (
    INTERACTIVE_TYPES.has(type) || INPUT_BINDINGS.has(binding) || Boolean(override?.onClick) || Boolean(widgetMenuClick) || hasPointerState(node)
  )
  const onControlClick = DROPDOWN_TYPES.has(type) && control && override?.open === undefined
    ? (event: ReactMouseEvent<HTMLElement>) => { event.stopPropagation(); control.toggleOpen() }
    : TOGGLE_TYPES.has(type) && control && override?.checked === undefined && !override?.onClick
      ? (event: ReactMouseEvent<HTMLElement>) => { event.stopPropagation(); control.toggleChecked() }
      : undefined
  const heldState = override?.state ?? (
    (TOGGLE_TYPES.has(type) || classes.includes('switch') || classes.includes('switchLine')) && checked
      ? 'checked' as const
      : undefined
  )
  const hoverable = Boolean(tooltip) || elided
  const onTooltipEnter = hoverable ? (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.currentTarget
    if (tooltip) {
      tooltipStore.show({
        source: uid,
        ...tooltip,
        resolve: tooltip.resolve,
        text: tooltip.text,
        delay: tooltip.delay,
        rect: canvasRectFromDom(target),
      })
      return
    }
    const label = override?.text ?? officialText(node)
    if (!label || !isTruncated(target)) return
    tooltipStore.show({
      source: uid,
      tree: 'TextTooltip',
      text: label,
      rect: canvasRectFromDom(target),
    })
  } : undefined
  const onTooltipLeave = hoverable ? () => tooltipStore.hide(uid) : undefined
  // Nested VisualTreeAsset interiors keep the template's rule_index, namespaced
  // as `uitk-inline-{doc}-{N}` so the host sheet cannot steal (README §11).
  const inlineClass = uitkInlineClass(node.rule_index, uitkTemplate ?? treeName)
  // Inlined VisualTreeAssets (`keepPaint`) keep USS tint on Vector sprites.
  // applyUitkEffects only reads `background-image`; applyResolvedSprite turns a
  // tint into `--official-mask-image`. `.official-tinted-bg` is what paints it.
  const tinted = hasTintedBackground(spriteUrl ? { ...painted.style, 'background-image': spriteUrl } : painted.style)
  const stateCss = uitkPaint ? '' : nodeCascadeCss(uid, painted, ancestorIds)
  const domProps = {
    className: ['official-node', `official-${type}`, ...classes, ...(RUNTIME_CLASSES[type] ?? []), inlineClass, hasBackground && 'has-background', tinted && 'official-tinted-bg', (override?.onClick || widgetMenuClick) && 'is-clickable', hoverable && 'is-hoverable', interactive && 'is-interactive', open && 'is-open', frame?.className, dragHandle && 'official-drag-handle'].filter(Boolean).join(' '),
    style,
    'data-binding': binding || undefined,
    'data-type': type,
    'data-ui': uitkAncestry(type),
    'data-name': node.name || node.binding || undefined,
    'data-tree': treeName || undefined,
    'data-uitk-template': uitkTemplate || undefined,
    'data-full-type': node.full_type || undefined,
    'data-unity-id': node.id == null ? undefined : String(node.id),
    'data-sprite': spriteName || (typeof painted.style?.['background-image'] === 'string' ? painted.style['background-image'] : undefined),
    'data-slice': (nineSlice(painted.style) ?? []).join(' ') || undefined,
    'data-giny': ginyPrimitive(painted),
    'data-picking': ignoresPointer ? 'ignore' : undefined,
    'data-state': heldState,
    'data-checked': checked || heldState === 'checked' || undefined,
    'data-selected': heldState === 'selected' || undefined,
    'data-disabled': override?.disabled || undefined,
    // A window is always a plain element: `Tag` is only polymorphic for the
    // controls, and a control never carries a frame.
    ref: frame?.ref as Ref<HTMLDivElement & HTMLSpanElement & HTMLButtonElement> | undefined,
    'data-window': frame?.chrome.id,
    'data-drag-handle': dragHandle ? 'true' : undefined,
    disabled: isButton ? override?.disabled : undefined,
    onClick: chain<ReactMouseEvent<HTMLElement>>(override?.onClick, widgetMenuClick, onControlClick),
    onDoubleClick: override?.onDoubleClick,
    onScroll: override?.onScroll,
    onContextMenu: override?.onContextMenu,
    onPointerDownCapture: frame?.handlers.onPointerDownCapture,
    onPointerDown: chain<ReactPointerEvent<HTMLElement>>(frame?.handlers.onPointerDown, override?.onPointerDown),
    onPointerMove: chain<ReactPointerEvent<HTMLElement>>(frame?.handlers.onPointerMove, override?.onPointerMove),
    onPointerUp: chain<ReactPointerEvent<HTMLElement>>(frame?.handlers.onPointerUp, override?.onPointerUp),
    onPointerCancel: chain<ReactPointerEvent<HTMLElement>>(frame?.handlers.onPointerCancel, override?.onPointerUp),
    onPointerEnter: onTooltipEnter,
    onPointerLeave: onTooltipLeave,
    type: isButton ? ('button' as const) : undefined,
  }
  const children: ReactNode[] = []
  if (stateCss) children.push(<style key="state">{stateCss}</style>)
  if (frame?.before) children.push(<Fragment key="window-before">{frame.before}</Fragment>)
  const repeater = repeaters[binding]
  if (repeater) {
    const itemStyle = repeaterItemStyle(node)
    repeater.forEach((item) => {
      const body = cloneTemplateBody(templates[item.template])
      if (!body) return
      const fixedCell = type === 'ListView' && itemStyle.height != null
      const bodyStyle = fixedCell ? { width: '100%', ...(body.style?.height == null ? { height: '100%' } : {}) } : itemStyle
      const rendered = <VisualNode key={item.key} node={item.flowWindow ? prepared({ ...body, properties: { ...body.properties, 'giny-window-flow': 'true' } }) : body} resolve={item.resolve} scope={item.key} repeaters={item.repeaters ?? EMPTY_REPEATER} templates={templates} hideDropdownList={props.hideDropdownList} rootStyle={bodyStyle} keepPaint uitkTemplate={item.template.split('#')[0]} />
      // Unity's fixed item height sizes the transparent recycling cell, not
      // its authored 110px child. Preserve the spacing around that child.
      children.push(fixedCell ? <div key={item.key} className="official-list-cell" style={{ ...itemStyle, width: '100%', flexShrink: 0 }}>{rendered}</div> : rendered)
    })
  } else if (override?.replaceChildren) {
    children.push(isValidElement(override.children) ? cloneElement(override.children, { key: 'override' }) : override.children)
  } else {
    if (override?.children) children.push(isValidElement(override.children) ? cloneElement(override.children, { key: 'override' }) : override.children)
    // A control with an injected interior draws its text through its own label
    // node, so a binding override has to reach that label instead of the leaf
    // content it would have replaced on a childless node.
    const interior = inventorySlot ? slotInterior(node, interiorSprite, override?.quantity) : type === 'Divider' ? dividerInterior(node, override?.text) : node.children
    const official = repeated(inlinedHostChildren(type, interior, templates, node, uitkTemplate ?? treeName), override?.repeat)
    const sided = type === 'Switch' ? withSwitchSide(official, checked) : type === 'CheckboxCustom' ? withCheckboxState(official, checked) : official
    const imageUrl = ownerImageUrl(node)
    const sprite = inventorySlot ? undefined : painted.sprite ?? imageUrl
    const imaged = sprite && sided.length > 0 ? withOwnerSprite(sided, sprite, classes.includes('asset')) : sided
    const liveInput = type === 'TextInput' && (override?.onInput != null || override?.text != null)
    const promoteCheckbox = type === 'CheckboxCustom' && override?.text != null && checkboxLineNeedsCaption(imaged)
    if (promoteCheckbox) {
      // UXML sized the host as the 24×24 box. ``.checkboxLine`` USS is a row
      // (gap 8, no width); keep the inline 24px and the caption clips.
      delete style.width
      delete style.height
    }
    const officialChildren = liveInput
      ? withLiveTextInput(imaged, override?.text ?? '') ?? imaged
      : promoteCheckbox ? withOverrideText(withCheckboxLineCaption(imaged, override.text as string, checked), override.text as string)
      : override?.text != null && imaged.length > 0 ? withOverrideText(imaged, override.text) : imaged
    if (!override?.children && officialChildren.length === 0) children.push(...leafContent(painted, override?.text))
    if (PROGRESS_TYPES.has(type) && officialChildren.length === 0 && !override?.children) {
      children.push(<i key="fill" className={`official-progress-fill is-${gaugeOrientation}`} />)
    }
    if (type === 'Tile' && override?.quantity != null) children.push(<span key="quantity" style={{position:'absolute',right:3,bottom:2,zIndex:2,fontSize:14,color:'#fff',textShadow:'1px 1px 2px #000'}}>{override.quantity}</span>)
    if (override?.look && !override?.children) {
      if (style.position == null || style.position === 'static') style.position = 'relative'
      children.push(<EntityPreview key="look" look={override.look} mode={override.lookMode ?? 'portrait'} staticImage={override.lookStatic} facing={override.lookFacing} />)
    }
    if (type === 'EntityStatsGraph' && officialChildren.length === 0 && !override?.children) {
      if (style.position == null || style.position === 'static') style.position = 'relative'
      children.push(<EntityStatsGraphPaint key="graph" node={node} values={override?.graph ?? []} />)
    }
    const childAncestors = [...ancestorIds, uid]
    const handleName = frame?.chrome.handleName
    const hideDropdownList = props.hideDropdownList || (DROPDOWN_TYPES.has(type) && !open)
    const nestedTemplate = uitkNestedTemplate(type, node, uitkTemplate ?? treeName)
    const childTemplate = nestedTemplate ?? uitkTemplate
    const childKeepPaint = keepPaint || Boolean(nestedTemplate)
    officialChildren.forEach((child, index) => children.push(<VisualNode
      key={`${child.id ?? 'node'}-${index}`}
      node={child}
      resolve={resolve}
      scope={nextScope}
      repeaters={repeaters}
      templates={templates}
      parentBinding={binding}
      childIndex={index}
      ancestorIds={childAncestors}
      hideDropdownList={hideDropdownList}
      keepPaint={childKeepPaint}
      uitkTemplate={childTemplate}
      dragHandle={handleName && child.name === handleName ? { height: frame?.handleHeight, children: frame?.handleChildren } : undefined}
    />))
  }
  if (type === 'DofusIntegerField' && override?.text != null) {
    children.length = 0
    children.push(<input key="number" className="official-native-input" type="number" aria-label={binding} value={override.text} onChange={override.onInput ?? (() => undefined)} readOnly={!override.onInput} />)
  }
  if (DROPDOWN_TYPES.has(type) && override?.options) {
    children.push(<select key="native-choice" className="official-native-select" aria-label={override.text || binding}
      value={override.selectedOption} onChange={event => override.onSelect?.(event.target.value)}
      onClick={event => event.stopPropagation()}>
      {override.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>)
  }
  if (dragHandle?.children) children.push(<Fragment key="giny-handle-chrome">{dragHandle.children}</Fragment>)
  if (frame?.after) children.push(<Fragment key="window-after">{frame.after}</Fragment>)
  const tree = <Tag {...domProps} data-official-id={uid}>{children}</Tag>
  if (type === 'TextInput' && override?.onInput) {
    return <TextInputLiveContext value={{ value: override.text ?? '', placeholder: override.placeholder, onInput: override.onInput, onKeyDown: override.onKeyDown }}>{tree}</TextInputLiveContext>
  }
  return tree
}

/** Repeat a `tile-grid`'s compiled prototype, rebinding each copy.

    The official SlotGrid holds no fixed count: the constructor fills the space
    its host gives it with `item-size` tiles. The extractor exports one compiled
    tile and the caller says how many the window currently holds. */
function repeated(children: VisualTreeNode[], count?: number): VisualTreeNode[] {
  if (!count || count < 0 || !children.length) return children
  // Two prototypes come out of the extractor when the grid alternates its cell
  // backgrounds, so cycling them keeps that alternation.
  return Array.from({ length: count }, (_, index) => {
    const source = index % children.length
    const clone = structuredClone(children[source])
    reindex(clone, source, index)
    return clone
  })
}

/** Renumber a cloned cell: the prototype's index appears in its own binding and
    in the names of the parts the grid built around it. */
function reindex(node: VisualTreeNode, from: number, to: number): void {
  const pattern = new RegExp(`([:_])${from}$`)
  const swap = (value?: string | number) =>
    typeof value === 'string' ? value.replace(pattern, (_match, separator: string) => `${separator}${to}`) : value
  node.binding = swap(node.binding) as string | undefined
  node.name = swap(node.name) as string | undefined
  for (const child of node.children ?? []) reindex(child, from, to)
}

function withOverrideText(children: VisualTreeNode[], text: string): VisualTreeNode[] {
  let placed = false
  const visit = (node: VisualTreeNode): VisualTreeNode => {
    if (placed) return node
    if (/label$/i.test(node.binding ?? node.name ?? '')) {
      placed = true
      return { ...node, text }
    }
    if (!node.children?.length) return node
    return { ...node, children: node.children.map(visit) }
  }
  return children.map(visit)
}

function ownerImageUrl(node: VisualTreeNode): string | undefined {
  // A named vector icon takes precedence over the serialized asset fallback.
  if (node.properties?.['icon-type'] === 'Icon' && node.properties?.['icon-value']) return undefined
  const value = [node.properties?.['image-url'], node.properties?.imageUrl, node.properties?.['img-url'], node.properties?.imgUrl]
    .find((entry) => typeof entry === 'string' && entry.includes('/'))
  return typeof value === 'string' ? value : undefined
}

function withOwnerSprite(children: VisualTreeNode[], sprite: string, preferAsset = false): VisualTreeNode[] {
  let placed = false
  const token = preferAsset ? 'asset' : 'icon'
  const visit = (node: VisualTreeNode): VisualTreeNode => {
    if (placed) return node
    // `applyContentVariantSlots` hides the unused 20px icon; painting into
    // a `display: none` leaf would leave the visible slot empty.
    if (String(node.style?.display).toLowerCase() === 'none') return node
    const name = (node.binding ?? node.name ?? '').toLowerCase()
    if (name.includes(token) && !(node.children?.length)) {
      placed = true
      return { ...node, sprite }
    }
    if (!node.children?.length) return node
    return { ...node, children: node.children.map(visit) }
  }
  return children.map(visit)
}

function isTileGrid(node: VisualTreeNode): boolean {
  return /SlotGrid$/i.test(node.type ?? '')
    && ['true', '1'].includes(String(node.properties?.['tile-grid'] ?? node.properties?.tileGrid ?? '').toLowerCase())
}

/** InlineXmlGrid columns come from `item-width` and `flex-direction="Row"`. */
function applyInlineXmlGridLayout(node: VisualTreeNode, style: CSSProperties): void {
  const direction = String(node.properties?.['flex-direction'] ?? node.properties?.flexDirection ?? '').toLowerCase()
  if (direction) {
    style.flexDirection = direction.startsWith('column') ? 'column' : 'row'
  }
  const columns = Number(node.properties?.['fixed-column-count'] ?? node.properties?.fixedColumnCount)
  if (!Number.isFinite(columns) || columns === 0) {
    style.flexWrap = 'wrap'
    if (style.alignContent == null) style.alignContent = 'flex-start'
  }
}

function leafContent(node: VisualTreeNode, textOverride?: string): ReactNode[] {
  const type = node.type ?? ''
  const binding = node.binding ?? node.name ?? ''
  // A text input only needs a real editable field when the extracted interior
  // did not provide one; the field inherits the component's own USS.
  // ``textInput_placeholder`` is a DofusLabel (constructor ``m_placeholderLabel``),
  // not an input — INPUT_BINDINGS is only the user-text layer.
  if (type === 'TextInput' || INPUT_BINDINGS.has(binding)) {
    return [<LeafInput key="input" node={node} textOverride={textOverride} />]
  }
  const result: ReactNode[] = []
  const text = textOverride ?? officialText(node)
  // UITK paints the string on the Label/host. A nested span is a second box
  // (rank: 15 screens, ~557k px) that shrink-wraps to line-height and leaves
  // ``-unity-text-align`` centering an inner 20px strip inside a 24px host.
  // Sprites follow the same rule: they live on the Image/Vector host, not in
  // a ``span.official-icon`` sized to the PNG.
  if (text) result.push(text)
  return result
}

/** Native field for ``#textInput_userText``. Placeholder text comes from UXML,
    never from a homemade string. A bound host drives value through context.
    `max-length` (chat `256` strict) caps the field like the C# constructor. */
function LeafInput({ node, textOverride }: { node: VisualTreeNode; textOverride?: string }) {
  const live = useContext(TextInputLiveContext)
  const placeholder = live?.placeholder ?? cleanText(String(node.properties?.placeholderText ?? node.properties?.['placeholder-text'] ?? ''))
  const maxLength = Number(node.properties?.['max-length'] ?? node.properties?.maxLength ?? 0)
  const value = live?.value ?? textOverride ?? officialText(node)
  return <input
    className="official-native-input"
    autoComplete="off"
    spellCheck={false}
    maxLength={Number.isFinite(maxLength) && maxLength > 0 ? maxLength : undefined}
    placeholder={placeholder || undefined}
    {...(live ? { value, onChange: live.onInput, onKeyDown: live.onKeyDown } : { defaultValue: value })}
  />
}

function cleanText(value: string): string { return value.replace(/^\[(.*)]$/, '$1') }
/** Labels the C# client writes in code, so the UXML ships none. Keyed by the
    leaf binding the label lands on (`ServerSelection` carries its own text;
    `characterSelection`/`characterCreation` do not). */
const RUNTIME_LABELS: Record<string, string> = {
  playButton_label: 'Jouer',
}
function officialText(node: VisualTreeNode): string {
  if (node.placeholder_text) return ''
  const props = node.properties ?? {}
  const text = node.text ?? props.text ?? props.placeholderText ?? props['placeholder-text'] ?? props.rightText ?? props['right-Text'] ?? props.buttonText ?? props['button-text']
  const binding = node.binding ?? node.name ?? ''
  return cleanText(String(text ?? RUNTIME_LABELS[binding] ?? ''))
}
