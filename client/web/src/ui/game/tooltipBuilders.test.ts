import { describe, expect, it } from 'vitest'
import {
  ItemTooltipBuilder,
  buildSpellTooltipRepeaters,
  SpellTooltipBuilder,
  parseCriteriaExpression,
  parseCriterionString,
} from './tooltipBuilders'
import type { HudItem, HudSpell } from '../../giny/types'

describe('tooltipBuilders', () => {
  it('efface les exemples de l’arbre officiel et utilise les valeurs de sort Giny', () => {
    const tip = SpellTooltipBuilder.Build({ id: 13026, name: 'Inertie', grade: 1, source: 'giny',
      description: 'Description serveur', ap_cost: 3, min_range: 0, range: 0, max_cast_per_target: 1,
      min_cast_interval: 4, preview_zones: ['P1'], states_criterion: '', effect_lines: ['Effet serveur'] })
    expect(tip.resolve?.('lbl_throwPerTargetValue')?.text).toBe('1')
    expect(tip.resolve?.('lbl_intervalThrowValue')?.text).toBe('4')
    expect(tip.resolve?.('lbl_zoneValue')?.text).toBe('P1')
    expect(tip.resolve?.('lbl_description')?.text).toBe('Description serveur')
    expect(tip.resolve?.('lbl_requiredStateValue')?.text).toBe('')
    for (const binding of ['ctr_requiredState', 'ctr_globalCastPerTurn', 'ctr_globalThrowPerTarget', 'ctr_intervalGlobal', 'ctr_intervalInitThrow', 'lbl_cellFree', 'lbl_notThroughPortals'])
      expect(tip.resolve?.(binding)?.hidden).toBe(true)
  })
  describe('criteria parser', () => {
    it('parses player level criterion', () => {
      const parsed = parseCriterionString('PL>80')
      expect(parsed).toMatch(/80/)
    })

    it('parses characteristic criteria with 2-letter codes', () => {
      expect(parseCriterionString('CS>100')).toBe('Force > 100')
      expect(parseCriterionString('CW<50')).toBe('Sagesse < 50')
      expect(parseCriterionString('CP>8')).toBe('PA > 8')
    })

    it('parses composite expressions separated by & and |', () => {
      const expr = parseCriteriaExpression('PL>60&CS>80|CW>30')
      expect(expr).toHaveLength(3)
      expect(expr[1]).toBe('Force > 80')
      expect(expr[2]).toBe('Sagesse > 30')
    })

    it('parses non-equipable BI criterion', () => {
      expect(parseCriterionString('BI')).toMatch(/non équipable/i)
    })
  })

  describe('ItemTooltipBuilder', () => {
    it('builds weapon tooltip with live characteristics and instance effects', () => {
      const item: HudItem = {
        uid: 101,
        gid: 44, // Épée de Boisaille
        name: 'Épée de Boisaille',
        quantity: 1,
        position: 1,
        equipped: true,
        appearance_id: 0,
        level: 7,
        is_weapon: true,
        ap_cost: 4,
        min_range: 1,
        range: 1,
        critical_hit_probability: 15,
        average_price: 350,
        effects: [
          { effect_id: 96, value: 5, min: 4, max: 8 }, // 4 à 8 dommages Eau
        ],
        criteria: 'PL>5',
        criteria_ok: true,
      }

      const tip = ItemTooltipBuilder.Build(item)
      expect(tip.tree).toBe('ItemTooltip')
      expect(tip.resolve?.('lbl_itemName')?.text).toBe('Épée de Boisaille')
      expect(tip.resolve?.('ctr_weaponCastConditions')?.hidden).toBe(false)
      expect(tip.resolve?.('lbl_apValue')?.text).toBe('4')
      expect(tip.resolve?.('lbl_reachValue')?.text).toBe('1')
      expect(tip.resolve?.('lbl_criticalValue')?.text).toBe('15 %')
      expect(tip.resolve?.('dataSection_price')?.hidden).toBe(false)
      expect(tip.resolve?.('lbl_generalDataPrice')?.text).toBe('350')
      expect(tip.resolve?.('dataSection_warningUnmatchedCriterions')?.hidden).toBe(true)
    })

    it('displays official warning when criteria_ok is false', () => {
      const item: HudItem = {
        uid: 102,
        gid: 44,
        name: 'Épée de Boisaille',
        quantity: 1,
        position: 63,
        equipped: false,
        appearance_id: 0,
        level: 7,
        criteria: 'PL>150',
        criteria_ok: false,
      }

      const tip = ItemTooltipBuilder.Build(item)
      expect(tip.resolve?.('dataSection_warningUnmatchedCriterions')?.hidden).toBe(false)
      expect(tip.resolve?.('lbl_warningUnmatchedCriterions')?.text).toMatch(/conditions/i)
    })
  })

  it('separates normal and critical effects and omits empty sections', () => {
    const blocks = buildSpellTooltipRepeaters(['19 à 22 dommages Feu'], ['25 à 27 dommages Feu']).ctr_tooltipBlocks
    expect(blocks.map(block => block.resolve?.('lbl_blockTitle')?.text)).toEqual(['Effets', 'Effets critiques'])
    expect(blocks[0].repeaters?.ctr_blockStats[0].resolve?.('lbl_statName')?.text).toBe('19 à 22 dommages Feu')
    expect(blocks[1].repeaters?.ctr_blockStats[0].resolve?.('lbl_statName')?.text).toBe('25 à 27 dommages Feu')
    expect(buildSpellTooltipRepeaters(['Effet normal'], []).ctr_tooltipBlocks).toHaveLength(1)
    expect(buildSpellTooltipRepeaters([], []).ctr_tooltipBlocks).toHaveLength(0)
  })

  describe('SpellTooltipBuilder', () => {
    it('populates cast conditions, LOS, turn limits and preview zone', () => {
      const spell: HudSpell = {
        id: 12983,
        name: 'Retour du Bâton',
        grade: 1,
        ap_cost: 3,
        min_range: 1,
        range: 4,
        cast_in_line: true,
        cast_test_los: true,
        max_cast_per_turn: 2,
        max_cast_per_target: 1,
        min_cast_interval: 0,
        preview_zones: ['P1'],
      }

      const tip = SpellTooltipBuilder.Build(spell, '1')
      expect(tip.tree).toBe('SpellTooltip')
      expect(tip.resolve?.('lbl_spellName')?.text).toBe('Retour du Bâton')
      expect(tip.resolve?.('shortcut')?.text).toBe('1')
      expect(tip.resolve?.('lbl_apValue')?.text).toBe('3')
      expect(tip.resolve?.('lbl_reachValue')?.text).toBe('1-4')
      expect(tip.resolve?.('ctr_lineOfSight')?.hidden).toBe(false)
      expect(tip.resolve?.('lbl_lineOfSight')?.text).toBe('Ligne de vue')
      expect(tip.resolve?.('ctr_castShapeCondition')?.hidden).toBe(false)
      expect(tip.resolve?.('lbl_castShapeCondition')?.text).toBe('En ligne')
      expect(tip.resolve?.('ctr_castPerTurn')?.hidden).toBe(false)
      expect(tip.resolve?.('lbl_castPerTurn')?.text).toBe('2')
      expect(tip.resolve?.('ctr_throwPerTarget')?.hidden).toBe(false)
      expect(tip.resolve?.('lbl_throwPerTarget')?.text).toBe('1 / cible')
      expect(tip.resolve?.('ctr_zone')?.hidden).toBe(false)
      expect(tip.resolve?.('lbl_zone')?.text).toBe('P1')
    })
  })
})
