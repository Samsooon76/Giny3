import type { VisualTreeNode } from './types'

export const SCROLL_TYPES = new Set(['ScrollView', 'ListView'])
export const DROPDOWN_TYPES = new Set(['Dropdown', 'DropdownButton'])
export const TOGGLE_TYPES = new Set([
  'CheckboxCustom', 'Checkbox', 'Switch', 'RadioButton', 'RadioButtonCustom', 'DofusToggleButtonCustom',
])
export const PROGRESS_TYPES = new Set([
  'ExtendedProgressBarFloat', 'ExtendedProgressBarInt', 'ExtendedProgressBarLong', 'ProgressBar',
])
export const ENTITY_TYPES = new Set(['EntityDisplayer', 'EntityPortrait'])
/** The Figma TextInput paints a Label at ``#textInput_placeholder``
    (IL2CPP ``m_placeholderLabel``) and a value layer at ``#textInput_text``.
    Only ``#textInput_userText`` is the editable field. Treating the other two
    as ``<input>`` hid the placeholder string and split the 196px field into
    three 56px columns. */
export const INPUT_BINDINGS = new Set(['textInput_userText'])

/** Hosts whose children reuse generic ids (``lbl_content``, ``colorPickerField_color``,
    ``checkboxLine_labelRight``). The renderer scopes the subtree to the host
    binding so a resolver can tell copies apart, the way it already does for
    ``ServerCard`` and ``<Instance>``. */
export const SCOPED_HOST_TYPES = new Set([
  'ServerCard', 'Instance', 'ColorPickerField', 'Tile', 'CharacterPresetManager',
  'CheckboxCustom', 'DofusTab',
])

/** Only dropdowns and toggles keep React state. Scroll, gauges and portraits
    are paint-time adapters — putting `useState` on every VisualNode would
    mount tens of thousands of hooks. */
export function isStatefulControl(type: string): boolean {
  return DROPDOWN_TYPES.has(type) || TOGGLE_TYPES.has(type)
}

/** IL2CPP `GaugeColorEnum` (custom, primary, green, red, orange, grey,
    purple, pink, yellow, blue). Fills use the same tokens as
    `.gaugeStandard.{color} #gaugeStandard_fill` in MergedUSS. */
export const GAUGE_COLOR_VARS: Record<string, string> = {
  primary: 'var(--highlight_primary100)',
  green: 'var(--qualitative_lightGreen100)',
  red: 'var(--qualitative_lightRed100)',
  orange: 'var(--qualitative_sun100)',
  grey: 'var(--white_white50)',
  purple: 'var(--highlight_secondary100)',
  pink: 'var(--qualitative_pink100)',
  yellow: 'var(--qualitative_yellow100)',
  blue: 'var(--qualitative_blue100)',
}

export function progressColor(node: VisualTreeNode, extraClass?: string): string | undefined {
  const custom = node.properties?.['custom-progressBar-color']
    ?? node.properties?.['progressBar-color']
    ?? node.properties?.progressBarColor
  if (typeof custom === 'string' && custom) return custom
  const named = String(node.properties?.['gauge-color'] ?? node.properties?.gaugeColor ?? '').trim()
  if (named && GAUGE_COLOR_VARS[named]) return GAUGE_COLOR_VARS[named]
  const classes = [...(node.classes ?? []), ...(extraClass?.split(/\s+/) ?? [])]
  for (const token of classes) {
    if (GAUGE_COLOR_VARS[token]) return GAUGE_COLOR_VARS[token]
  }
  return undefined
}

export function isDropdownListPart(node: VisualTreeNode): boolean {
  const name = (node.binding ?? node.name ?? '').toLowerCase()
  return name === 'dropdown_list' || name.startsWith('dropdown_list')
}

/** C# keeps the popup in the tree and only shows it while `activatedTrue`. */
export function hideClosedDropdownList(open: boolean, node: VisualTreeNode): boolean {
  return !open && isDropdownListPart(node)
}

export function childScope(type: string | undefined, binding: string, scope?: string): string | undefined {
  if (binding && (SCOPED_HOST_TYPES.has(type ?? '') || /:\d+$/.test(binding))) return binding
  return scope
}

/** C# ``CreateSimpleLabel`` when UXML left ``CheckboxCustom`` as a 24×24 box.

    Extractor ``_promote_checkbox_line`` only wraps when ``right-Text`` is
    authored. Cosmetics ``chk_obtainedFilter`` / Appearance ``chk_hideUnavailable``
    have no caption in UXML — IL2CPP still writes ``UiCosmeticNotObtained`` /
    ``UiCosmeticHideUnavailableFaces``. Do not invent a ``checkbox_label``
    inside the box (0 hits in metadata). */
export function withCheckboxLineCaption(
  children: VisualTreeNode[],
  text: string,
  checked: boolean,
): VisualTreeNode[] {
  if (children.some((child) => (child.binding ?? child.name) === 'checkboxLine_labelRight')) {
    return children
  }
  const box: VisualTreeNode = {
    type: 'VisualElement',
    classes: ['checkbox', checked ? 'activeTrue' : 'activeFalse'],
    children,
  }
  const label: VisualTreeNode = {
    type: 'DofusLabel',
    name: 'checkboxLine_labelRight',
    binding: 'checkboxLine_labelRight',
    classes: ['dofusLabel'],
    properties: { name: 'checkboxLine_labelRight' },
    text,
  }
  return [box, label]
}

export function checkboxLineNeedsCaption(children: VisualTreeNode[] | undefined): boolean {
  return !(children ?? []).some((child) => (child.binding ?? child.name) === 'checkboxLine_labelRight')
}

export function initialChecked(node: VisualTreeNode): boolean {
  const classes = node.classes ?? []
  if (node.type === 'Switch' || classes.includes('switch') || classes.includes('switchLine')) {
    if (classes.includes('left')) return false
    if (classes.includes('right')) return true
  }
  if (classes.some((name) => /activeTrue|activatedTrue|checkedTrue/i.test(name))) return true
  const value = String(node.properties?.state ?? node.properties?.value ?? node.properties?.checked ?? '').toLowerCase()
  return value === 'true' || value === '1' || value === 'checked'
}

/** Swap an Ankama boolean class pair (`activeFalse` / `activeTrue`). */
export function swapFlagClass(classes: string[], on: boolean, prefix: string): string[] {
  const next = classes.filter((name) => name !== `${prefix}True` && name !== `${prefix}False`)
  next.push(on ? `${prefix}True` : `${prefix}False`)
  return next
}

/** Binding classNames that replace a USS variant rather than stacking both.

    `DofusButtonCustom` without `main-style` extracts as `.secondary`; C# still
    stamps `.primary` on the character-sheet CTA. `entityMainStats` swaps
    `.Simple` / `.Advanced` the same way. */
const EXCLUSIVE_CLASS_GROUPS = [
  ['primary', 'secondary', 'tertiary'],
  ['Simple', 'Advanced'],
  // ``quest.uxml`` / ``InlineGridItem_gd_quests_default.uss``: UXML rest is
  // ``.category`` (header dummy). C# stamps ``.quest`` on encyclopaedia rows.
  ['category', 'quest'],
  // DofusTab constructor rest is ``activeFalse``. The selected encyclopaedia
  // tab stamps ``activeTrue`` the same way ``swapFlagClass`` does for toggles.
  ['activeTrue', 'activeFalse'],
  // C# ``CreateSimpleLabel`` promotes the 24×24 ``.checkbox`` host to
  // ``.checkboxLine``. The inner box keeps ``.checkbox``.
  ['checkbox', 'checkboxLine'],
]

export function mergeExclusiveClasses(classes: string[], extra?: string): string[] {
  if (!extra) return classes
  const tokens = extra.split(/\s+/).filter(Boolean)
  let next = [...classes]
  for (const token of tokens) {
    const group = EXCLUSIVE_CLASS_GROUPS.find((items) => items.includes(token))
    if (group) next = next.filter((name) => !group.includes(name))
    if (!next.includes(token)) next.push(token)
  }
  // GridView stamps `dummy-item` on empty cells. C# drops it once a tile
  // carries `.asset` / `.acquiredTrue`.
  if (tokens.includes('asset') || tokens.includes('acquiredTrue')) {
    next = next.filter((name) => name !== 'renderstudio-grid-view__dummy-item')
  }
  return next
}

/** USS thumbs and icon tints key on ``.left`` / ``.right``, not ``activeTrue``. */
export function swapSideClass(classes: string[], right: boolean): string[] {
  const next = classes.filter((name) => name !== 'left' && name !== 'right')
  next.push(right ? 'right' : 'left')
  return next
}

export function withSwitchSide(nodes: VisualTreeNode[], right: boolean): VisualTreeNode[] {
  return nodes.map((node) => {
    const classes = node.classes ?? []
    const isSwitch = classes.includes('switch') || classes.includes('switchLine')
    return {
      ...node,
      classes: isSwitch ? swapSideClass(classes, right) : classes,
      children: node.children?.length ? withSwitchSide(node.children, right) : node.children,
    }
  })
}

export function progressOrientation(node: VisualTreeNode): 'vertical' | 'horizontal' {
  const value = String(node.properties?.['gauge-orientation'] ?? node.properties?.gaugeOrientation ?? '').toLowerCase()
  if (value === 'vertical' || value === '1') return 'vertical'
  return 'horizontal'
}

export function progressFill(node: VisualTreeNode, value?: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.min(100, value))
  const propVal = node.properties?.value
  const raw = typeof propVal === 'number' ? propVal : typeof propVal === 'string' && propVal.trim() !== '' ? Number(propVal) : 0
  const max = Number(node.properties?.highValue ?? node.properties?.['high-value'] ?? 100) || 100
  if (!Number.isFinite(raw)) return 0
  return Math.max(0, Math.min(100, (raw / max) * 100))
}

/** CheckboxLine stores its paint state on the inner checkbox as well. */
export function withCheckboxState(nodes: VisualTreeNode[], checked: boolean): VisualTreeNode[] {
  return nodes.map(node => ({ ...node,
    classes: node.classes?.includes('checkbox') ? swapFlagClass(node.classes, checked, 'active') : node.classes,
    children: node.children?.length ? withCheckboxState(node.children, checked) : node.children,
  }))
}
