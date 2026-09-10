import type { BindingResolver } from '../official/types'

/** Runtime geometry missing from the authoring pose. The original trees stay
 * authoritative for hierarchy; these values reproduce the supplied captures. */
export function referenceFixups(tree: string): BindingResolver {
  return (binding) => {
    if (['quests','guildBase','playerSpell'].includes(tree) && binding === 'window_background') return { style: { backgroundImage: 'none', backgroundColor: '#1b1c30' } }
    if (tree === 'quests') {
      if (binding === 'lbl_questDescription') return { style: { whiteSpace: 'normal', height: 'auto', overflow: 'visible', lineHeight: '20px', fontStyle: 'italic' } }
      if (binding === 'dd_steps') return { hidden: true }
    }
    if (tree === 'playerSpell') {
      if (binding === 'ctr_spellContainer') return { style: { maxHeight: 'none', padding: '16px 24px', gap: 28 } }
      if (binding === 'ctr_leftSpellContainer' || binding === 'ctr_rightSpellContainer') return { style: { width: 'calc(50% - 14px)', flexGrow: 0, alignItems: 'stretch' } }
      if (binding === 'ctr_verticalDivider') return { hidden: true }
    }
    return undefined
  }
}
