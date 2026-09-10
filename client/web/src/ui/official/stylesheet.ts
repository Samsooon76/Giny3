import { RefreshableResource } from '../../game/assets/RefreshableResource'
/** USS the extractor could not fold into a node, because the class it is keyed
    by is added by a C# constructor rather than authored in UXML.

    `tg_statsView` is a `DofusToggleButtonGroupCustom` with an empty class list
    and an empty style, yet `MergedUSS` carries `.toggleGroup { flex-direction:
    row }`: the component adds that class when it is built. Without it the group
    falls back to Unity's column default and squeezes its two 32px buttons into
    16px each. This module reads those few rules back out of the extracted
    sheet, so the values stay Ankama's. */

/** Classes a component's constructor adds, and whose rules therefore have to be
    looked up rather than read off the node. */
export const RUNTIME_CLASSES: Record<string, string[]> = {
  DofusToggleButtonGroupCustom: ['toggleGroup'],
  TableColumnHeader: ['tableColumnHeader'],
  ExtendedProgressBarInt: ['extend-progress-bar'],
  ExtendedProgressBarFloat: ['extend-progress-bar'],
  ExtendedProgressBarLong: ['extend-progress-bar'],
  ColorPickerField: ['colorPickerField'],
  DofusIntegerField: ['dofus-integer-field'],
}

/** Components whose layout exists only in C#: no selector anywhere in the
    extracted sheets describes them. */
export const RUNTIME_STYLES: Record<string, Record<string, unknown>> = {
  // A tab group lines its `DofusTab` children up along the bottom. There is no
  // `.tabGroup` rule in any sheet, so the axis is the constructor's alone.
  DofusTabGroup: { 'flex-direction': 'row', 'align-items': 'flex-end' },
}

const SHEET_URL = '/ui-data/styles/MergedUSS.json'

export type RawValue = { type?: string; value?: unknown }
export type RawProperty = { name?: string; values?: RawValue[] }
export type RawRule = { selectors?: string[]; properties?: RawProperty[] }

/** Tokens Ankama authors instead of the standard property. The extractor
    rewrites these when it compiles a node, so a rule read straight from the
    sheet has to be rewritten the same way. */
const TOKEN_PROPERTY: Record<string, string> = {
  '--gap': 'gap',
  '--line-height': 'line-height',
  '--shadow': 'box-shadow',
  '--text-case': 'text-transform',
}

function one(entry: RawValue): unknown {
  if (entry.type === 'dimension') return entry.value
  if (entry.type === 'float' || entry.type === 'int') return entry.value
  return entry.value == null ? undefined : String(entry.value)
}

/** A serialised USS value list, in the shape a compiled node style uses. */
function compileValue(values: RawValue[]): unknown {
  const meaningful = values.filter((entry) => entry.type !== 'function')
  // `var(--token)`: the variable name is what a compiled node carries, and the
  // converter turns it back into a CSS custom property.
  const variable = meaningful.find((entry) => entry.type === 'variable')
  if (variable) return String(variable.value)
  if (meaningful.length === 1) return one(meaningful[0])
  return meaningful.map(one)
}

function compileRule(rule: RawRule): Record<string, unknown> {
  const style: Record<string, unknown> = {}
  for (const property of rule.properties ?? []) {
    const name = property.name ? TOKEN_PROPERTY[property.name] ?? property.name : ''
    if (!name || name.startsWith('--')) continue
    const value = compileValue(property.values ?? [])
    if (value !== undefined) style[name] = value
  }
  return style
}

let state: Record<string, Record<string, unknown>> = { ...RUNTIME_STYLES }
const listeners = new Set<() => void>()
type Sheet = { rules: RawRule[] }
const sheetResource = new RefreshableResource<Sheet>(async () => {
  const response = await fetch(SHEET_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Styles : HTTP ${response.status}`)
  const sheet = await response.json() as Sheet
  if (!Array.isArray(sheet.rules)) throw new Error('Feuille de styles invalide')
  return sheet
})
let pending: Promise<void> | undefined
let generation = 0
let appliedSheet: Sheet | undefined

/** Only the exact base selector of a class we inject ourselves is read. A
    looser match would start applying rules the extractor deliberately left off
    a node, which is not this module's business. */
export function compileComponentRules(rules: RawRule[]): Record<string, Record<string, unknown>> {
  const wanted = new Map<string, string>()
  for (const [type, classes] of Object.entries(RUNTIME_CLASSES)) {
    for (const name of classes) wanted.set(`.${name}`, type)
  }
  const found: Record<string, Record<string, unknown>> = {}
  for (const rule of rules) {
    for (const selector of rule.selectors ?? []) {
      const type = wanted.get(selector.trim())
      if (!type) continue
      found[type] = { ...found[type], ...compileRule(rule) }
    }
  }
  return found
}

export const componentStyles = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  snapshot: () => state,
  invalidate() {
    generation++; pending = undefined; sheetResource.invalidate()
  },
  retry(): Promise<void> { componentStyles.invalidate(); return componentStyles.load() },
  load(): Promise<void> {
    if (pending) return pending
    const current = generation
    const work = sheetResource.get().then(sheet => {
      if (current !== generation || !sheet || sheet === appliedSheet) return
      const resolved = compileComponentRules(sheet.rules)
      const next: Record<string, Record<string, unknown>> = { ...RUNTIME_STYLES }
      for (const [type, style] of Object.entries(resolved)) next[type] = { ...style, ...RUNTIME_STYLES[type] }
      appliedSheet = sheet
      state = next
      for (const listener of listeners) listener()
    }).finally(() => { if (pending === work) pending = undefined })
    pending = work
    return work
  },
}
