/** Construct and fill official window headers from extracted chrome properties. */
import type { VisualTreeNode } from './types'
import { isWindowNode, readWindowChrome, type WindowChrome } from './windowChrome'
import { HEADER_VARIANTS, headerButtonUss, titleBarUss } from './windowChromeStyles'

function named(node: VisualTreeNode): string {
  return node.binding ?? node.name ?? ''
}

function ve(name: string, extras: Partial<VisualTreeNode> = {}): VisualTreeNode {
  return { type: 'VisualElement', name, binding: name, classes: [], properties: { name }, style: {}, children: [], ...extras }
}

/** Inject `.header.primary` on every WindowFigma that C# would build a title bar for,
    and rewrite magnetic `#header_label` captions (`UiWidgetMinimap` → Mini carte).

    Current cache trees still wrap `#window_content` without the header. The
    extractor now injects it; this pass fills the gap without a recompile and
    writes the constructor title (`Inventaire` / `Cosmétiques` / `Mini carte`) onto
    `#header_titleLabel` / `#header_label`. Layout keys are the USS numbers so UITK defaults
    (`flex-direction: column`) cannot beat `:where(.header.primary)`. */
export function stampFigmaHeaders(node: VisualTreeNode): VisualTreeNode {
  if (node.name === 'win_paddockUi') node = { ...node, properties: { ...node.properties, 'with-title-bar': 'true', 'header-title': 'Enclos' } }
  const chrome = isWindowNode(node) ? readWindowChrome(node) : undefined
  const host = chrome?.kind === 'figma' && chrome.titleBar ? withFigmaHeader(node, chrome)
    : chrome?.kind === 'magnetic' && chrome.handleName === 'header' ? fillMagneticCaption(node, chrome)
      : node
  const children = host.children?.map(stampFigmaHeaders)
  if (!children) return host
  if (host === node && children.every((child, index) => child === node.children?.[index])) return node
  return { ...host, children }
}

/** Magnetic headers already live in the extracted tree. Cache JSON still
    holds the UXML placeholder (`MINI-MAP`) until the next named-strings pass;
    write the constructor caption onto `#header_label`. `CreateHeader` also
    fills `#header_buttonRight` with omit-default `moreActions` and nests
    `header-icon-left` into `#header_left` (chat `expand`). */
function fillMagneticCaption(node: VisualTreeNode, chrome: WindowChrome): VisualTreeNode {
  const kids = node.children ?? []
  const index = kids.findIndex((child) => named(child) === 'header')
  if (index < 0) return node
  const filled = fillMagneticHeader(kids[index], chrome)
  if (filled === kids[index]) return node
  const next = [...kids]
  next[index] = filled
  return { ...node, children: next }
}

function fillMagneticHeader(header: VisualTreeNode, chrome: WindowChrome): VisualTreeNode {
  const walked = fillFigmaHeaderPart(header, chrome)
  const children = nestMagneticHeaderButtons(walked.children ?? [], chrome)
  const same = walked === header && children.every((child, index) => child === header.children?.[index])
  return same ? header : { ...walked, children }
}

function nestMagneticHeaderButtons(children: VisualTreeNode[], chrome: WindowChrome): VisualTreeNode[] {
  const leftBtn = removeNamed(children, 'header_buttonLeft')
  const rightBtn = removeNamed(leftBtn.nodes, 'header_buttonRight')
  const leftSlot = removeNamed(rightBtn.nodes, 'header_left')
  const rightSlot = removeNamed(leftSlot.nodes, 'header_right')
  const rest = rightSlot.nodes
  const slot = (
    slotName: string,
    buttonName: string,
    icon: string | undefined,
    strayBtn?: VisualTreeNode,
    straySlot?: VisualTreeNode,
  ) => {
    if (!icon) return undefined
    const existing = strayBtn ?? findNamed(straySlot?.children ?? [], buttonName)
    const button = magneticHeaderButton(buttonName, icon, existing)
    const layout = magneticHeaderSlotStyle(slotName)
    if (!straySlot) return ve(slotName, { style: layout, children: [button] })
    return {
      ...straySlot,
      style: { ...straySlot.style, ...layout },
      children: [...(straySlot.children ?? []).filter((child) => named(child) !== buttonName), button],
    }
  }
  const left = slot('header_left', 'header_buttonLeft', chrome.leftIcon, leftBtn.taken, leftSlot.taken)
  const right = slot('header_right', 'header_buttonRight', chrome.rightIcon, rightBtn.taken, rightSlot.taken)
  return [...(left ? [left] : []), ...rest, ...(right ? [right] : [])]
}

function removeNamed(nodes: VisualTreeNode[], id: string): { nodes: VisualTreeNode[]; taken?: VisualTreeNode } {
  let taken: VisualTreeNode | undefined
  const out: VisualTreeNode[] = []
  for (const node of nodes) {
    if (!taken && named(node) === id) {
      taken = node
      continue
    }
    if (node.children?.length) {
      const inner = removeNamed(node.children, id)
      if (inner.taken) taken = inner.taken
      out.push(inner.nodes === node.children ? node : { ...node, children: inner.nodes })
    } else {
      out.push(node)
    }
  }
  return { nodes: out, taken }
}

function findNamed(nodes: VisualTreeNode[], id: string, nested = false): VisualTreeNode | undefined {
  for (const node of nodes) {
    if (named(node) === id) return node
    if (nested) {
      const inner = findNamed(node.children ?? [], id, true)
      if (inner) return inner
    }
  }
  return undefined
}

function magneticHeaderButton(id: string, icon: string, existing?: VisualTreeNode): VisualTreeNode {
  const box = headerButtonUss('widget').button
  const radius = id === 'header_buttonRight'
    ? { 'border-top-right-radius': { value: 1, unit: 'px' } }
    : { 'border-radius': { value: 2, unit: 'px' } }
  return {
    type: 'DofusButtonCustom',
    name: id,
    binding: id,
    classes: [...new Set([...(existing?.classes ?? []), 'button'])],
    properties: { ...(existing?.properties ?? {}), name: id, icon },
    sprite: existing?.sprite ?? icon,
    style: {
      ...existing?.style,
      width: box.width,
      'min-width': box.width,
      height: box.height,
      'min-height': box.height,
      'justify-content': 'center',
      'align-items': 'center',
      'flex-shrink': 0,
      ...radius,
    },
    children: [],
  }
}

/** USS `.header.widget #header_left` / `#header_content` / `#header_right`.
    Same `ussToCss` `position: relative` trap as the Figma bar. */
function magneticHeaderSlotStyle(id: string): Record<string, unknown> | undefined {
  if (id === 'header_left') {
    return {
      position: 'absolute',
      left: 0,
      top: 0,
      width: { value: 20, unit: 'px' },
      height: { value: 20, unit: 'px' },
      padding: { value: 2, unit: 'px' },
      'flex-direction': 'row',
    }
  }
  if (id === 'header_content') {
    return {
      position: 'absolute',
      width: { value: 100, unit: '%' },
      'flex-direction': 'row',
      'justify-content': 'center',
      'align-items': 'center',
    }
  }
  if (id === 'header_right') return headerButtonUss('widget').slot
  return undefined
}

function withFigmaHeader(node: VisualTreeNode, chrome: WindowChrome): VisualTreeNode {
  const kids = node.children ?? []
  const index = kids.findIndex((child) => named(child) === 'header')
  if (index >= 0) {
    const filled = fillFigmaHeader(kids[index], chrome)
    if (filled === kids[index]) return node
    const next = [...kids]
    next[index] = filled
    return { ...node, children: next }
  }
  const header = buildFigmaHeader(chrome)
  const at = kids.findIndex((child) => named(child) === 'window_content')
  const children = at < 0 ? [...kids, header] : [...kids.slice(0, at), header, ...kids.slice(at)]
  return { ...node, children }
}

function fillFigmaHeader(header: VisualTreeNode, chrome: WindowChrome): VisualTreeNode {
  const layout = figmaHeaderLayout(chrome)
  const next = { ...header, classes: headerClasses(header, chrome), style: { ...layout, ...header.style } }
  // Compiled caches may still put the title icon in the left action slot.
  // HeaderWindow groups it with the caption; keep left actions independent.
  const relocated = removeNamed(header.children ?? [], 'header_icon')
  const groupIcon = (node: VisualTreeNode): VisualTreeNode => {
    if (named(node) === 'header_title' && relocated.taken) {
      return { ...node, children: [relocated.taken, ...(node.children ?? [])] }
    }
    return { ...node, children: node.children?.map(groupIcon) }
  }
  let children = (relocated.taken ? relocated.nodes.map(groupIcon) : header.children ?? [])
    .map((child) => fillFigmaHeaderPart(child, chrome))
  // Cache headers sometimes only wrap `#header_content`. USS still places
  // `#header_right` absolute at `right: 0`; `show-close-button` fills it.
  if (!children.some((child) => named(child) === 'header_right')) {
    children = [...children, withHeaderRight(ve('header_right', {
      style: headerButtonUss(chrome.headerStyle).slot,
    }), chrome)]
  }
  const same = children.every((child, index) => child === header.children?.[index])
    && next.classes === header.classes
    && next.style === header.style
  return same ? header : { ...next, children }
}

function fillFigmaHeaderPart(node: VisualTreeNode, chrome: WindowChrome): VisualTreeNode {
  const id = named(node)
  let next = node
  if (id === 'header_titleLabel') {
    const text = chrome.title ?? ''
    const grown = node.style?.['flex-grow'] === 1 || node.style?.['flex-grow'] === 1.0
    if (node.text !== text || node.type !== 'DofusLabel' || grown) {
      const style = grown ? figmaTitleLabelStyle(node.style ?? {}) : node.style
      next = {
        ...node,
        type: 'DofusLabel',
        text,
        classes: [...new Set([...(node.classes ?? []), 'dofusLabel', 'official-window-title'])],
        ...(style !== node.style ? { style } : {}),
      }
    }
  }
  if (id === 'header_label') {
    const text = chrome.title ?? ''
    if (node.text !== text) next = { ...node, text }
  }
  if (id === 'header_icon_asset' && chrome.icon && node.sprite !== chrome.icon) {
    next = { ...next, sprite: chrome.icon }
  }
  const slot = chrome.kind === 'figma' ? figmaHeaderSlotStyle(id, chrome)
    : chrome.kind === 'magnetic' ? magneticHeaderSlotStyle(id)
      : undefined
  if (slot) next = { ...next, style: { ...next.style, ...slot } }
  const children = (next.children ?? []).map((child) => fillFigmaHeaderPart(child, chrome))
  const walked = next === node && children.every((child, index) => child === node.children?.[index])
    ? next
    : { ...next, children }
  return named(walked) === 'header_title' ? withTitleShortcut(walked, chrome)
    : named(walked) === 'header_right' ? withHeaderRight(walked, chrome)
      : walked
}

/** `HeaderWindow.CreateTitleShortCut` parents a `ShortcutFigs` named
    `header_shortcut` under `#header_title` (USS flex row, `--gap: 8px`).
    Registry: ShortcutFigs `root_class` is `CTAElements`; enum 0 is
    `filled` / `purple`. `GenerateShortcuts` fills `#CTAElements_label`. */
function withTitleShortcut(title: VisualTreeNode, chrome: WindowChrome): VisualTreeNode {
  if (!chrome.shortcut) return title
  const kids = title.children ?? []
  const index = kids.findIndex((child) => named(child) === 'header_shortcut')
  if (index >= 0) {
    const filled = fillShortcutFigs(kids[index], chrome.shortcut)
    if (filled === kids[index]) return title
    const next = [...kids]
    next[index] = filled
    return { ...title, children: next }
  }
  return { ...title, children: [...kids, buildHeaderShortcut(chrome.shortcut)] }
}

function withHeaderRight(right: VisualTreeNode, chrome: WindowChrome): VisualTreeNode {
  if (chrome.kind !== 'figma') return right
  const kids = right.children ?? []
  const buttons = headerRightButtons(kids, chrome)
  if (kids.length === buttons.length && buttons.every((child, index) => child === kids[index])) return right
  return { ...right, children: buttons }
}

function headerRightButtons(kids: VisualTreeNode[], chrome: WindowChrome): VisualTreeNode[] {
  const existing = (id: string) => kids.find((child) => named(child) === id)
  const buttons: VisualTreeNode[] = []
  if (chrome.helpButton) buttons.push(existing('header_buttonHelp') ?? buildFigmaHelp(chrome.helpIcon))
  if (chrome.closeButton) buttons.push(existing('header_buttonRight') ?? buildFigmaClose())
  return buttons
}

/** USS `.header .button#header_buttonHelp` is 32px, `border-radius: 2px`.
    `help-icon` is the DofusButtonCustom `icon` enum (`cog` on auction). */
function buildFigmaHelp(icon?: string): VisualTreeNode {
  return {
    type: 'DofusButtonCustom',
    name: 'header_buttonHelp',
    binding: 'header_buttonHelp',
    classes: ['button'],
    properties: { name: 'header_buttonHelp', ...(icon ? { icon } : {}) },
    ...(icon ? { sprite: icon } : {}),
    style: {
      width: { value: 32, unit: 'px' },
      'min-width': { value: 32, unit: 'px' },
      height: { value: 32, unit: 'px' },
      'min-height': { value: 32, unit: 'px' },
      'border-radius': { value: 2, unit: 'px' },
      'flex-shrink': 0,
    },
    children: [],
  }
}

/** USS `.header.primary .button#header_buttonRight` is the 32px close
    `show-close-button` creates. Widget `#header_buttonRight` is the 20px
    more-actions control — that one stays on MagneticDragWindow. The close
    sprite is the one `titleBarUss().close` already takes from the sheets. */
function buildFigmaClose(): VisualTreeNode {
  const close = titleBarUss('primary').close
  return {
    type: 'DofusButtonCustom',
    name: 'header_buttonRight',
    binding: 'header_buttonRight',
    classes: ['button'],
    properties: { name: 'header_buttonRight' },
    sprite: 'styles/images/btn_close_normal.png',
    style: {
      width: { value: 32, unit: 'px' },
      'min-width': { value: 32, unit: 'px' },
      height: { value: 32, unit: 'px' },
      'min-height': { value: 32, unit: 'px' },
      'border-radius': { value: 4, unit: 'px' },
      'flex-shrink': 0,
      'background-image': close['background-image'],
      'background-color': close['background-color'],
      'border-width': 0,
      'unity-background-scale': 'scale-to-fit',
    },
    children: [],
  }
}

function fillShortcutFigs(node: VisualTreeNode, key: string): VisualTreeNode {
  const size = key.length === 1 ? 'single' : 'multi'
  const classes = [...new Set([...(node.classes ?? []), 'CTAElements', 'filled', size, 'purple'])]
  const kids = node.children ?? []
  if (!kids.length) return { ...node, type: 'ShortcutFigs', classes, children: buildHeaderShortcut(key).children }
  let changed = node.type !== 'ShortcutFigs' || classes.length !== (node.classes ?? []).length
  const children = kids.map((child) => {
    if (named(child) !== 'CTAElements_content') return child
    const inner = (child.children ?? []).map((part) => {
      if (named(part) !== 'CTAElements_label') return part
      if (part.text === key && part.type === 'DofusLabel') return part
      return { ...part, type: 'DofusLabel', text: key }
    })
    const same = inner.every((part, i) => part === child.children?.[i])
    if (same) return child
    changed = true
    return { ...child, children: inner }
  })
  if (!changed && children.every((child, i) => child === kids[i])) return node
  return { ...node, type: 'ShortcutFigs', classes, children }
}

function buildHeaderShortcut(key: string): VisualTreeNode {
  const size = key.length === 1 ? 'single' : 'multi'
  return {
    type: 'ShortcutFigs',
    name: 'header_shortcut',
    binding: 'header_shortcut',
    classes: ['CTAElements', 'filled', size, 'purple'],
    properties: { name: 'header_shortcut', 'shortcut-values': `KEY:${key}` },
    style: {
      ...(size === 'single'
        ? { width: { value: 20, unit: 'px' }, 'min-width': { value: 20, unit: 'px' } }
        : {}),
      height: { value: 20, unit: 'px' },
      'min-height': { value: 20, unit: 'px' },
      'flex-direction': 'row',
      'justify-content': 'center',
      'align-items': 'center',
      'flex-shrink': 0,
    },
    children: [ve('CTAElements_content', {
      style: {
        ...(size === 'single'
          ? { width: { value: 20, unit: 'px' }, 'min-width': { value: 20, unit: 'px' } }
          : {}),
        height: { value: 20, unit: 'px' },
        'min-height': { value: 20, unit: 'px' },
        overflow: 'hidden',
        'justify-content': 'center',
        'align-items': 'center',
      },
      children: [{
        type: 'DofusLabel',
        name: 'CTAElements_label',
        binding: 'CTAElements_label',
        classes: ['dofusLabel'],
        properties: { name: 'CTAElements_label' },
        text: key,
        style: {},
        children: [],
      }],
    })],
  }
}

function headerClasses(header: VisualTreeNode, chrome: WindowChrome): string[] {
  const classes = new Set(header.classes ?? [])
  classes.add('header')
  classes.add(chrome.headerStyle)
  return [...classes]
}

function figmaHeaderLayout(chrome: WindowChrome): Record<string, unknown> {
  const variant = HEADER_VARIANTS[chrome.headerStyle]
  return {
    'flex-shrink': 0,
    'flex-direction': 'row',
    'justify-content': 'space-between',
    'align-items': 'center',
    position: 'relative',
    top: { value: 0, unit: 'px' },
    width: { value: 100, unit: '%' },
    height: { value: variant.height, unit: 'px' },
    overflow: 'hidden',
    'z-index': 1,
    'border-top-left-radius': { value: 12, unit: 'px' },
    'border-top-right-radius': { value: 12, unit: 'px' },
  }
}

function figmaTitleLabelStyle(headline: Record<string, unknown>): Record<string, unknown> {
  const { 'flex-grow': _grow, 'flex-shrink': _shrink, ...style } = headline
  return style
}

/** USS `.header #header_left` / `#header_content` / `#header_right`.

    `ussToCss` defaults `position: relative` inline, which beats the
    `:where(.header [data-name])` absolute rules. Stamp the USS numbers so the
    title stays centered on the full bar instead of in the leftover flex gap. */
function figmaHeaderSlotStyle(id: string, chrome: WindowChrome): Record<string, unknown> | undefined {
  const variant = HEADER_VARIANTS[chrome.headerStyle]
  if (id === 'header_left') {
    return {
      position: 'absolute',
      left: 0,
      top: 0,
      width: { value: variant.iconBox, unit: 'px' },
      'min-width': { value: variant.iconBox, unit: 'px' },
      height: { value: variant.height, unit: 'px' },
      'min-height': { value: variant.height, unit: 'px' },
      'flex-direction': 'row',
      'justify-content': 'center',
      'align-items': 'center',
      padding: { value: 10, unit: 'px' },
    }
  }
  if (id === 'header_content') {
    return {
      position: 'absolute',
      width: { value: 100, unit: '%' },
      'padding-top': { value: 8, unit: 'px' },
      'padding-bottom': { value: 8, unit: 'px' },
      'justify-content': 'center',
      'align-items': 'center',
    }
  }
  if (id === 'header_right') return headerButtonUss(chrome.headerStyle).slot
  return undefined
}

function buildFigmaHeader(chrome: WindowChrome): VisualTreeNode {
  const variant = HEADER_VARIANTS[chrome.headerStyle]
  const parts = titleBarUss(chrome.headerStyle)
  const icon = chrome.icon ? ve('header_icon', {
    style: parts.icon,
    children: [ve('header_icon_asset', { sprite: chrome.icon, style: { width: { value: 100, unit: '%' }, height: { value: 100, unit: '%' } } })],
  }) : undefined
  const ornaments = chrome.ornament ? [
    ve('header_ornament_left', { style: { ...parts.ornament, right: undefined, scale: [1, 1] } }),
    ve('header_ornament_right', { style: parts.ornament }),
  ] : []
  return {
    type: 'VisualElement',
    name: 'header',
    binding: 'header',
    classes: ['header', chrome.headerStyle],
    properties: { name: 'header' },
    style: figmaHeaderLayout(chrome),
    children: [
      ...ornaments,
      ve('header_left', { style: figmaHeaderSlotStyle('header_left', chrome), children: [] }),
      ve('header_content', {
        style: figmaHeaderSlotStyle('header_content', chrome),
        children: [ve('header_title', {
          style: {
            width: { value: 100, unit: '%' },
            height: { value: variant.lineHeight, unit: 'px' },
            'flex-direction': 'row',
            'justify-content': 'center',
            'align-items': 'center',
            gap: { value: 8, unit: 'px' },
          },
          children: [
            ...(icon ? [icon] : []),
            {
              type: 'DofusLabel',
              name: 'header_titleLabel',
              binding: 'header_titleLabel',
              classes: ['dofusLabel', 'official-window-title'],
              properties: { name: 'header_titleLabel' },
              text: chrome.title ?? '',
              // `#header_title` is `justify-content: center` + `--gap: 8px`.
              // `flex-grow: 1` on the label (homemade bar) pushed KEY chips to
              // the right edge instead of sitting next to the caption.
              style: figmaTitleLabelStyle(parts.headline),
              children: [],
            },
            ...(chrome.shortcut ? [buildHeaderShortcut(chrome.shortcut)] : []),
          ],
        })],
      }),
      ve('header_right', {
        style: figmaHeaderSlotStyle('header_right', chrome),
        children: headerRightButtons([], chrome),
      }),
    ],
  }
}


