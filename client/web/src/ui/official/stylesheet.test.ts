import { describe, expect, it } from 'vitest'
import { RUNTIME_CLASSES, RUNTIME_STYLES, compileComponentRules, type RawRule } from './stylesheet'

/** Rules copied verbatim out of `styles/MergedUSS.json`. */
const rules: RawRule[] = [
  {
    selectors: ['.toggleGroup'],
    properties: [
      { name: 'border-radius', values: [{ type: 'dimension', value: { value: 2, unit: 'px' } }] },
      { name: 'flex-direction', values: [{ type: 'enum', value: 'row' }] },
    ],
  },
  {
    selectors: ['.tableColumnHeader'],
    properties: [
      { name: 'height', values: [{ type: 'dimension', value: { value: 24, unit: 'px' } }] },
      { name: '--gap', values: [{ type: 'dimension', value: { value: 2, unit: 'px' } }] },
      { name: 'flex-direction', values: [{ type: 'enum', value: 'row' }] },
      { name: 'align-items', values: [{ type: 'enum', value: 'center' }] },
    ],
  },
  // A descendant rule: it belongs to a child, not to the component itself.
  { selectors: ['.toggleGroup .toggle#toggleGroup_toggle'], properties: [{ name: 'height', values: [{ type: 'dimension', value: { value: 32, unit: 'px' } }] }] },
  // A rule for a class the UXML already carries, which the extractor folded in.
  { selectors: ['.button.secondary'], properties: [{ name: 'flex-direction', values: [{ type: 'enum', value: 'row' }] }] },
  {
    selectors: ['.window #window_background'],
    properties: [{ name: 'background-color', values: [{ type: 'function', value: 'var' }, { type: 'float', value: 1 }, { type: 'variable', value: '--background_dark100' }] }],
  },
]

describe('component USS the extractor could not reach', () => {
  const styles = compileComponentRules(rules)

  it('gives a toggle group the row axis its constructor gives it', () => {
    expect(styles.DofusToggleButtonGroupCustom).toEqual({
      'border-radius': { value: 2, unit: 'px' },
      'flex-direction': 'row',
    })
  })

  it('rewrites Ankama gap token to the property the extractor emits', () => {
    expect(styles.TableColumnHeader).toMatchObject({
      height: { value: 24, unit: 'px' },
      gap: { value: 2, unit: 'px' },
      'flex-direction': 'row',
      'align-items': 'center',
    })
  })

  it('reads only the component base selector, never a descendant or a folded class', () => {
    // `.toggleGroup .toggle` styles the child, and `.button.secondary` is
    // already on the node: taking either would restyle nodes on a guess.
    expect(styles.DofusToggleButtonGroupCustom.height).toBeUndefined()
    expect(Object.keys(styles)).toEqual(['DofusToggleButtonGroupCustom', 'TableColumnHeader'])
  })

  it('keeps the layout of the component no sheet describes at all', () => {
    expect(RUNTIME_STYLES.DofusTabGroup).toMatchObject({ 'flex-direction': 'row' })
  })

  it('stamps the IntegerField constructor class MergedUSS keys on', () => {
    expect(RUNTIME_CLASSES.DofusIntegerField).toEqual(['dofus-integer-field'])
  })
})
