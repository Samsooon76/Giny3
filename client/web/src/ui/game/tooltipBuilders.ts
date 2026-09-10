import { createElement } from 'react'
import type { HudItem, HudSpell } from '../../giny/types'
import {
  item as catalogItem,
  spell as catalogSpell,
  decodeEffectLine,
  spellLevel,
  uiString,
} from './catalog'
import { formatInt } from './hudWidgets'
import { spellIconUrls } from './contentIcons'
import type { TooltipBinding } from '../official/types'
import type { Repeater } from '../official/repeaters'

function tooltipFooter(kind: 'item' | 'spell') {
  const key = (label: string) => createElement('kbd', null, label)
  const mouse = () => createElement('img', { src: '/dofus3/icons/mouseLeft.png', alt: 'Clic gauche', width: 18, height: 24 })
  const row = (...children: React.ReactNode[]) => createElement('div', { className: 'tooltip-shortcuts__row' }, ...children)
  return {
    hidden: false,
    className: 'tooltip-shortcuts',
    children: createElement('div', { className: 'tooltip-shortcuts__content' },
      row(mouse(), 'Options', key('Alt'), 'Épingler l’infobulle'),
      kind === 'spell'
        ? row('Maintenir', key('Ctrl'), 'Afficher les jets théoriques des effets')
        : row(key('Ctrl'), 'Valeurs théoriques'),
      kind === 'spell'
        ? row(key('Alt'), '+', mouse(), 'Déplacer dans la barre de sorts')
        : row(key('OEM1'), 'Comparer avec un objet équipé')),
  }
}

/** 2-letter criterion mapping matching Giny.World CriterionHandler classes. */
const CRITERION_LABELS: Record<string, string> = {
  PL: 'Niveau',
  CS: 'Force',
  cs: 'Force',
  CI: 'Intelligence',
  ci: 'Intelligence',
  CA: 'Agilité',
  ca: 'Agilité',
  CC: 'Chance',
  cc: 'Chance',
  CV: 'Vitalité',
  cv: 'Vitalité',
  CW: 'Sagesse',
  cw: 'Sagesse',
  CP: 'PA',
  CM: 'PM',
  PG: 'Classe',
  PO: 'Objet possédé',
  PE: 'Attitude',
  TL: 'Titre',
  OR: 'Ornement',
  BI: 'Objet non équipable',
  PZ: 'Abonné',
  Oa: 'Points de succès',
  Pw: 'Guilde',
  Py: 'Guilde',
  Pk: 'Panoplie',
}

export function parseCriterionString(criterion: string): string {
  criterion = criterion.trim()
  if (criterion === 'BI') {
    return uiString('ui.criterion.unusableItem') ?? 'Objet non équipable'
  }
  const match = criterion.match(/^([a-zA-Z]{2})\s*([><=!]=?)\s*(.+)$/)
  if (!match) return criterion
  const [, id, op, val] = match
  const label = CRITERION_LABELS[id] ?? id
  if (id === 'PL' && op === '>') {
    const minTpl = uiString('ui.common.minimumLevelCondition')
    if (minTpl) return minTpl.replace('{0}', val)
  }
  if (id === 'PL' && op === '<') {
    const maxTpl = uiString('ui.common.maximumLevelCondition')
    if (maxTpl) return maxTpl.replace('{0}', val)
  }
  return `${label} ${op} ${val}`
}

export function parseCriteriaExpression(expr: string): string[] {
  if (!expr || !expr.trim()) return []
  // Split on & and |
  const parts = expr.split(/[&|]/).map((p) => p.trim()).filter(Boolean)
  return parts.map(parseCriterionString)
}

export function buildItemTooltipRepeaters(lines: string[], conditions: string[] = []): Repeater | undefined {
  const blocks = []
  if (lines.length) {
    blocks.push({
      key: 'effects',
      template: 'ItemTooltipBlock',
      resolve: (binding: string) => {
        if (binding === 'ctr_blockTitle' || binding === 'lbl_blockTitle') return { hidden: true }
        return undefined
      },
      repeaters: {
        ctr_blockStats: lines.map((line, index) => ({
          key: `fx-${index}`,
          template: 'ItemTooltipStatLine',
          resolve: (binding: string) => {
            if (binding === 'lbl_statName') return { text: line }
            if (binding === 'lbl_statValueTheoretical') return { hidden: true }
            return undefined
          },
        })),
      },
    })
  }
  if (conditions.length) {
    blocks.push({
      key: 'conditions',
      template: 'ItemTooltipBlock',
      resolve: (binding: string) => {
        if (binding === 'lbl_blockTitle') return { text: uiString('ui.common.conditions') ?? 'Conditions' }
        if (binding === 'ctr_blockTitle') return { hidden: false }
        return undefined
      },
      repeaters: {
        ctr_blockStats: conditions.map((cond, index) => ({
          key: `cond-${index}`,
          template: 'ItemTooltipStatLine',
          resolve: (binding: string) => {
            if (binding === 'lbl_statName') return { text: cond }
            if (binding === 'lbl_statValueTheoretical') return { hidden: true }
            return undefined
          },
        })),
      },
    })
  }
  if (!blocks.length) return undefined
  return {
    ctr_tooltipBlocks: blocks,
  }
}

export class ItemTooltipBuilder {
  static Build(item: HudItem): TooltipBinding {
    const catalog = catalogItem(item.gid)
    const description = catalog?.description
    const weight = catalog?.realWeight

    // Instance effects take priority over possibleEffects
    let lines: string[] = []
    if (item.effects && item.effects.length > 0) {
      lines = item.effects.flatMap((e) => {
        const text = decodeEffectLine({
          effectId: e.effect_id,
          diceNum: e.min,
          diceSide: e.max,
          value: e.value,
        })
        return text ? [text] : []
      })
    }
    if (!lines.length && catalog?.possibleEffects) {
      lines = catalog.possibleEffects.flatMap((e) => {
        const text = decodeEffectLine(e)
        return text ? [text] : []
      })
    }

    const conditions = parseCriteriaExpression(item.criteria ?? catalog?.criteria ?? '')
    const isWeapon = item.is_weapon || catalog?.typeId === 2 || catalog?.typeId === 3 || catalog?.typeId === 4 || catalog?.typeId === 5 || catalog?.typeId === 6 || catalog?.typeId === 7 || catalog?.typeId === 8
    const ap = item.ap_cost ?? 0
    const minRange = item.min_range ?? 0
    const maxRange = item.range ?? 0
    const crit = item.critical_hit_probability ?? 0
    const itemSet = item.item_set_id && item.item_set_id > 0 ? { name: `Panoplie #${item.item_set_id}` } : undefined
    const avgPrice = item.average_price ?? 0
    const criteriaFailed = item.criteria_ok === false

    return {
      tree: 'ItemTooltip',
      text: item.name,
      repeaters: buildItemTooltipRepeaters(lines, conditions),
      resolve: (binding: string) => {
        if (binding === 'lbl_itemName') return { text: item.name }
        if (binding === 'lbl_level') {
          const level = uiString('ui.common.level') ?? 'Niveau'
          return { text: item.level ? `${level} ${item.level}` : '' }
        }
        if (binding === 'tooltipHeader') return { hidden: false }
        if (binding === 'lbl_generalCaptionInventoryQuantity') {
          const text = uiString('ui.common.quantity')
          return text ? { text } : undefined
        }
        if (binding === 'lbl_generalDataInventoryQuantity') return { text: formatInt(item.quantity) }
        if (binding === 'dataSection_inventoryQuantity') return { hidden: false }
        if (binding === 'ctr_tooltipBlocks') return lines.length || conditions.length ? { hidden: false } : { hidden: true }
        if (binding === 'lbl_description') return description ? { text: description } : undefined
        if (binding === 'ctr_tooltipDescription') return description ? { hidden: false } : { hidden: true }
        if (binding === 'dataSection_weight') return weight != null ? { hidden: false } : { hidden: true }
        if (binding === 'lbl_generalDataWeight' && weight != null) return { text: `${formatInt(weight)}` }

        // Weapon Characteristics
        if (binding === 'ctr_weaponCastConditions') return isWeapon && (ap || maxRange) ? { hidden: false } : { hidden: true }
        if (binding === 'lbl_apValue' && isWeapon && ap) return { text: String(ap) }
        if (binding === 'lbl_reachValue' && isWeapon && maxRange) {
          return { text: minRange === maxRange ? String(maxRange) : `${minRange}-${maxRange}` }
        }
        if (binding === 'lbl_criticalValue' && isWeapon && crit) return { text: `${crit} %` }
        if (binding === 'ctr_critical' && isWeapon) return crit ? { hidden: false } : { hidden: true }

        // Item set
        if (binding === 'lbl_itemSet') return itemSet ? { hidden: false, text: itemSet.name } : { hidden: true }

        // Prices
        if (binding === 'dataSection_price') return avgPrice > 0 ? { hidden: false } : { hidden: true }
        if (binding === 'lbl_generalDataPrice') return avgPrice > 0 ? { text: `${formatInt(avgPrice)}` } : undefined

        // Warning Unmatched Criteria
        if (binding === 'dataSection_warningUnmatchedCriterions') return criteriaFailed ? { hidden: false } : { hidden: true }
        if (binding === 'lbl_warningUnmatchedCriterions') {
          return criteriaFailed ? { text: uiString('ui.item.criterionUnmatched') ?? "Vous ne respectez pas les conditions d'obtention de cet objet" } : undefined
        }

        if (binding === 'ctr_tooltipFooter') return tooltipFooter('item')

        // Hidden default bindings
        if (binding === 'tooltipPinnedHeader' || binding === 'ctr_importantNotice' ||
            binding === 'ctr_category' || binding === 'ic_categorySeparator' ||
            binding === 'dataSection_colorable' || binding === 'dataSection_density' || binding === 'dataSection_remainingUse' ||
            binding === 'dataSection_priceLot' || binding === 'dataSection_dropRate' ||
            binding === 'dataSection_bankQuantity' || binding === 'dataSection_havenBagQuantity') {
          return { hidden: true }
        }
        return undefined
      },
    }
  }
}

/** Spell effects use separate headings, unlike inventory stat lists. */
export function buildSpellTooltipRepeaters(lines: string[], criticalLines: string[]): Repeater {
  return { ctr_tooltipBlocks: [
    { key: 'effects', title: 'Effets', lines },
    { key: 'critical-effects', title: 'Effets critiques', lines: criticalLines },
  ].filter(block => block.lines.length).map(block => ({
    key: block.key,
    template: 'ItemTooltipBlock',
    resolve: (binding: string) => binding === 'lbl_blockTitle' ? { text: block.title } : undefined,
    repeaters: { ctr_blockStats: block.lines.map((line, index) => ({
      key: `${block.key}-${index}`,
      template: 'ItemTooltipStatLine',
      resolve: (binding: string) => {
        if (binding === 'lbl_statValueTheoretical') return { hidden: true }
        if (binding !== 'lbl_statName') return undefined
        const icon = /dommages? Feu/i.test(line) ? 'fire' : /dommages? Eau/i.test(line) ? 'water'
          : /dommages? Terre/i.test(line) ? 'earth' : /dommages? Air/i.test(line) ? 'wind'
          : /dommages? Neutre/i.test(line) ? 'neutral' : undefined
        return { text: line, children: createElement('span', { className: 'spell-effect-line' },
          icon && createElement('img', { src: `/dofus3/icons/${icon}.png`, alt: '', width: 18, height: 18 }),
          createElement('span', null, line)) }
      },
    })) },
  })) }
}

export class SpellTooltipBuilder {
  static Build(spell: HudSpell, shortcut?: string): TooltipBinding {
    const level = spell.source === 'giny' ? undefined : spellLevel(spell.id, spell.grade ?? 1)
    const catalog = catalogSpell(spell.id)
    const lines = spell.effect_lines ?? (spell.preview_effects ?? level?.effects ?? []).flatMap((effect) => {
      const text = decodeEffectLine(effect)
      return text ? [text] : []
    })
    const criticalLines = (spell.preview_critical_effects ?? level?.criticalEffect ?? []).flatMap(effect => {
      const text = decodeEffectLine(effect)
      return text ? [text] : []
    })
    const description = spell.description ?? (spell.source === 'giny' ? undefined : catalog?.description)
    const ap = spell.ap_cost ?? level?.apCost
    const minRange = spell.min_range ?? level?.minRange ?? 0
    const maxRange = spell.range ?? level?.range
    const crit = spell.critical_hit_probability ?? level?.criticalHitProbability
    const perTurn = spell.max_cast_per_turn ?? level?.maxCastPerTurn
    const perTarget = spell.max_cast_per_target ?? level?.maxCastPerTarget
    const interval = spell.min_cast_interval ?? level?.minCastInterval
    const castInLine = spell.cast_in_line ?? level?.castInLine
    const testLos = spell.cast_test_los ?? level?.castTestLos
    const previewZone = spell.preview_zones?.[0]
    const stateReq = spell.states_criterion

    return {
      tree: 'SpellTooltip',
      text: spell.name,
      repeaters: buildSpellTooltipRepeaters(lines, criticalLines),
      resolve: (binding: string) => {
        const captions: Record<string, string> = {
          lbl_apTitle: 'Coût', lbl_reachTitle: 'Portée', lbl_castPerTurnTitle: 'Lancers par tour',
          lbl_criticalTitle: 'Critique', lbl_throwPerTargetTitle: 'Lancers par cible',
          lbl_intervalThrowTitle: 'Intervalle de relance', lbl_intervalGlobalTitle: 'Intervalle global',
          lbl_intervalInitThrowTitle: 'Relance initiale', lbl_cumulMaxEffectsTitle: 'Cumul max',
          lbl_zoneTitle: 'Zone', lbl_requiredStateTitle: 'État requis',
        }
        if (captions[binding]) return { text: captions[binding] }
        if (binding === 'lbl_apValue') return { text: ap == null ? '—' : String(ap) }
        if (binding === 'lbl_reachValue' && maxRange == null) return { text: '—' }
        // These are the names in the extracted SpellTooltip tree. Never leave
        // designer examples (Saoul, global limit 4, cooldown 1...) on screen.
        if (binding === 'lbl_throwPerTargetValue') return { text: perTarget == null ? '—' : String(perTarget) }
        if (binding === 'lbl_intervalThrowValue') return { text: interval == null ? '—' : String(interval) }
        if (binding === 'lbl_zoneValue') return { text: previewZone ?? '' }
        if (binding === 'lbl_requiredStateValue') return { text: stateReq ?? '' }
        if (binding === 'lbl_lineOfSightTitle') return { text: testLos ? 'Ligne de vue requise' : 'Sans ligne de vue' }
        if (binding === 'ctr_globalCastPerTurn' || binding === 'ctr_globalThrowPerTarget') return { hidden: true }
        if (binding === 'ctr_intervalGlobal') return { hidden: !spell.global_cooldown }
        if (binding === 'lbl_intervalGlobalValue') return { text: String(spell.global_cooldown ?? 0) }
        if (binding === 'ctr_intervalInitThrow') return { hidden: !spell.initial_cooldown }
        if (binding === 'lbl_intervalInitThrowValue') return { text: String(spell.initial_cooldown ?? 0) }
        if (binding === 'ctr_cumulMaxEffects') return { hidden: !spell.max_stack }
        if (binding === 'lbl_cumulMaxEffectsValue') return { text: String(spell.max_stack ?? 0) }
        if (binding === 'lbl_cellOccupied') return { hidden: !spell.need_taken_cell }
        if (binding === 'lbl_cellFree') return { hidden: !spell.need_free_cell }
        if (['lbl_visibleTarget', 'lbl_notThroughPortals', 'lbl_cellWithoutPortal'].includes(binding)) return { hidden: true }
        if (binding === 'lbl_spellName') return { text: spell.name }
        if (binding === 'lbl_spellRank') return spell.grade ? { text: `Rang ${spell.grade}` } : { hidden: true }
        if (binding === 'ctr_tooltipHeader') return { hidden: false }
        if (binding === 'ic_spell') {
          const sprite = spellIconUrls(spell.icon_id)[0]
          return sprite ? { sprite } : undefined
        }
        if (binding === 'shortcut' && shortcut) return { hidden: false, text: shortcut, style: { display: 'flex' } }
        if (binding === 'ctr_spellCastConditions') return { hidden: false }
        if (binding === 'lbl_apValue' && ap != null) return { text: String(ap) }
        if (binding === 'lbl_reachValue' && maxRange != null) {
          return { text: minRange === maxRange ? String(maxRange) : `${minRange}-${maxRange}` }
        }
        if (binding === 'lbl_criticalValue' && crit) return { text: `${crit} %` }
        if (binding === 'ctr_critical') return crit ? { hidden: false } : { hidden: true }
        if (binding === 'lbl_castPerTurn' && perTurn) return { text: String(perTurn) }
        if (binding === 'ctr_castPerTurn') return perTurn ? { hidden: false } : { hidden: true }

        // Spell Cast Details
        if (binding === 'ctr_lineOfSight') return testLos ? { hidden: false } : { hidden: true }
        if (binding === 'lbl_lineOfSight') return testLos ? { text: 'Ligne de vue' } : undefined

        if (binding === 'ctr_castShapeCondition') return castInLine ? { hidden: false } : { hidden: true }
        if (binding === 'lbl_castShapeCondition') return castInLine ? { text: 'En ligne' } : undefined

        if (binding === 'ctr_throwPerTarget') return perTarget ? { hidden: false } : { hidden: true }
        if (binding === 'lbl_throwPerTarget') return perTarget ? { text: `${perTarget} / cible` } : undefined

        if (binding === 'ctr_intervalThrow') return interval ? { hidden: false } : { hidden: true }
        if (binding === 'lbl_intervalThrow') return interval ? { text: `${interval} tours` } : undefined

        if (binding === 'ctr_zone') return previewZone ? { hidden: false } : { hidden: true }
        if (binding === 'lbl_zone') return previewZone ? { text: previewZone } : undefined

        if (binding === 'ctr_requiredState') return stateReq ? { hidden: false } : { hidden: true }
        if (binding === 'lbl_requiredState') return stateReq ? { text: stateReq } : undefined

        if (binding === 'lbl_description') return description ? { text: description } : undefined
        if (binding === 'ctr_description') return description ? { hidden: false } : { hidden: true }
        if (binding === 'ctr_tooltipBlocks') return lines.length || criticalLines.length ? { hidden: false } : { hidden: true }

        if (binding === 'ctr_tooltipFooter') return tooltipFooter('spell')
        if (binding === 'btn_pinQuit' || binding === 'btn_settings') {
          return { hidden: true }
        }
        return undefined
      },
    }
  }
}
