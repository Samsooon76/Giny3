import type { CreationSpell } from '../../giny/types'
import type { BindingOverride } from '../official/types'
import type { RepeaterItem } from '../official/repeaters'
import { resolveCreationSpellSlot } from './creationBindings'
import { listSpellVariants, spell as catalogSpell, spellLevel, spellIcon } from './catalog'
import { SpellTooltipBuilder } from './tooltipBuilders'

/** CharacterCreationUI.DisplayBreedSpells fills ctr_spells with m_spellTiles.
 * Clone the screen's own small spell Tile; names and effects belong in its tooltip. */
export function creationSpellTile(spell: CreationSpell): BindingOverride {
  const tooltip = SpellTooltipBuilder.Build({
      id: spell.id, grade: 1, name: spell.name, description: spell.description, icon_id: spell.icon_id,
      ap_cost: spell.ap_cost, min_range: spell.min_range, range: spell.range,
      critical_hit_probability: spell.critical_hit, effect_lines: spell.effects.length ? spell.effects : undefined,
    })
  return {
    ...resolveCreationSpellSlot(spell),
    onClick: () => undefined,
    tooltip: { ...tooltip, resolve: (binding, scope) => {
      const original = tooltip.resolve?.(binding, scope)
      if (binding === 'lbl_description') return { ...original, style: { whiteSpace: 'normal', height: 'auto', textOverflow: 'clip', overflow: 'visible' } }
      return original
    } },
  }
}

/** Variant rows are ordered by the client catalogue, never by adjacent base spells. */
export function creationSpellPairs(spells: CreationSpell[], breedId: number): CreationSpell[][] {
  const known = new Map(spells.map(spell => [spell.id, spell]))
  const used = new Set<number>()
  const pairs = listSpellVariants(breedId).map(variant => variant.spellIds.flatMap(id => {
    if (used.has(id)) return []
    const row = catalogSpell(id), level = spellLevel(id)
    const entry = known.get(id) ?? (row ? {
      id, name: row.name ?? '', description: row.description ?? '', icon_id: row.iconId ?? id,
      icon: '', ap_cost: level?.apCost ?? 0, min_range: level?.minRange ?? 0,
      range: level?.range ?? 0, critical_hit: level?.criticalHitProbability ?? 0, effects: [],
    } : undefined)
    if (!entry) return []
    used.add(id)
    return [entry]
  })).filter(pair => pair.length)
  for (const spell of spells) if (!used.has(spell.id)) pairs.push([spell])
  return pairs
}

export function creationSpellTiles(pairs: CreationSpell[][]): RepeaterItem[] {
  return pairs.map(pair => ({
    key: pair.map(spell => spell.id).join('-'), template: 'spellListEntry#gd_spellButtons',
    resolve: binding => binding === 'gd_spellButtons' ? { style: {
      position: 'relative', width: 144, height: 44, display: 'flex', flexDirection: 'row',
      gap: 0, overflow: 'hidden', borderRadius: 6, border: '1px solid #66675b',
      background: '#373a2f', boxShadow: '0 3px 6px #0006',
    } } : undefined,
    repeaters: { gd_spellButtons: pair.map((spell, index) => ({
      key: String(spell.id), template: 'characterCreation#spellSlot_1',
      resolve: binding => binding === 'spellSlot_1' ? {
        ...creationSpellTile(spell),
        sprite: spell.icon ? `/game-data/client/${spell.icon}` : spellIcon(catalogSpell(spell.id)?.iconId, catalogSpell(spell.id)?.picto),
        style: { width: 71, minWidth: 71, height: 44, minHeight: 44, backgroundSize: '38px 38px', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', padding: '3px 16px', margin: 0, flexShrink: 0,
          background: index === 0 ? '#777469' : 'transparent', borderRadius: 0,
          borderRight: index === 0 ? '1px solid #bab6a4' : undefined, opacity: index === 0 ? 1 : 0.6 },
      } : binding === 'itemTile_container' ? { hidden: true } : undefined,
    })) },
  }))
}
