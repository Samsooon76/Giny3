import type { CellGrid } from '../cells/CellGrid'
import type { CombatSnapshot } from '../../giny/combatState'
import type { HudSpell } from '../../giny/types'

export type DamagePreview = { id: number; min: number; max: number; heal: boolean; critical: boolean; element: number }[]
/** Adapter to Bubble's unmodified damageCalculation worker. Unknown combat
 * modifiers are never silently treated as zero. Server state remains read-only. */
export function damageInput(grid: CellGrid, state: CombatSnapshot, spell: HudSpell, target: number) {
  const caster = state.fighters.find(f => f.id === state.controlled_id)
  const effects = spell.preview_effects
  if (!caster || !effects?.length || state.marks.length || state.fighters.some(f => f.alive && (!f.preview_stats || f.preview_complex !== false || f.carried))) return null
  // Nested/triggered effects need their entire spell/buff dependency graph.
  if ([...effects,...(spell.preview_critical_effects??[])].some(e => ![91,92,93,94,95,96,97,98,99,100,108].includes(e.effectId) || e.duration || e.delay || e.random || (e.triggers && e.triggers !== 'I'))) return null
  const convertEffects = (effects: NonNullable<HudSpell['preview_effects']>, critical=false) => effects.map((e,i) => ({ id:i+1, level:spell.grade, order:e.order??i, actionId:e.effectId, param1:e.diceNum??e.value??0,
      param2:e.diceSide??0, param3:e.value??0, duration:0, isCritical:critical, triggers:'I', rawZone:e.rawZone??'P', masks:e.targetMask??'', randomWeight:0, randomGroup:0, isDispellable:true, delay:0, category:e.effectId===108?0:2 }))
  const bridgeSpell = { id: spell.id, level: spell.grade, minimaleRange: spell.min_range ?? 0, maximaleRange: spell.range ?? 1,
    criticalHitProbability: spell.critical_hit_probability??0, needsFreeCell: !!spell.need_free_cell, needsTakenCell: !!spell.need_taken_cell, maxEffectsStack: spell.max_stack ?? 0,
    effects: convertEffects(effects), criticalEffects:convertEffects(spell.preview_critical_effects??[],true) }
  const fighters = state.fighters.filter(f => f.alive && f.cell >= 0).map(f => ({
    id:f.id, level:f.level, breed:f.breed, playerType:f.breed?'human':'monster', teamId:f.team, stats:f.preview_stats,
    buffs:[], isAlly:f.team===caster.team, isInvisible:!!f.invisible, isSummon:false, isStaticElement:false,
    currentPosition:f.cell, beforeLastSpellPosition:f.cell, previousPosition:f.cell, startedPosition:f.cell, turnBeginPosition:f.cell,
    healthPoints:f.life, maxHealthPoints:f.max_life, usedPM:0, summonerId:0, inheritanceCoefficients:null,
    canUsePortals:true, canSwitchPosOnTarget:true, canSwitchPos:true, canBePushed:true, canBeCarried:true,
  }))
  return { snapshot: { caster:{id:caster.id}, fighters, spell:bridgeSpell, targetedCell:target, gameTurn:state.turn,
    inputPortal:-1, includeCritical:!!spell.preview_critical_effects?.length, forceCritical:false, isPreview:true, marks:[], outputPortalByInput:{}, carriedByCarrier:{},
    spellsByKey:{}, unresolvableSpellKeys:[], stateEffectsById:{}, summonMonstersByKey:{}, bombComboCoeffByBreed:{},
    walkableCells:grid.cells.map(c=>c.mov===1&&!c.nonWalkableDuringFight) }, cellLosFlags:grid.cells.map(c=>c.los?2:0),
    losBlockingCells:fighters.map(f=>f.currentPosition) }
}
/** Preserve elemental and critical rows from Bubble instead of merging them. */
export function collectDamagePreview(affected: { id: number; effects: { damageRange?: { min: number; max: number; elemId: number; isHeal: boolean; isCritical: boolean } | null }[] }[]): DamagePreview {
  const result: DamagePreview = []
  for (const fighter of affected) for (const effect of fighter.effects) {
    const d = effect.damageRange
    if (!d) continue
    let row = result.find(r => r.id === fighter.id && r.heal === d.isHeal && r.critical === d.isCritical && r.element === d.elemId)
    if (!row) { row = { id: fighter.id, min: 0, max: 0, heal: d.isHeal, critical: d.isCritical, element: d.elemId }; result.push(row) }
    row.min += d.min; row.max += d.max
  }
  return result
}
export class SpellDamagePreview {
  private worker: Worker | null = null
  private revision = 0
  private pending = new Map<number, (value: DamagePreview | null) => void>()
  compute(grid: CellGrid, state: CombatSnapshot, spell: HudSpell, target: number): Promise<DamagePreview | null> {
    const input = damageInput(grid,state,spell,target)
    if (!input) return Promise.resolve(null)
    if (!this.worker) {
      this.worker = new Worker(new URL('/combat-assets/damage-preview-worker.js', location.href), {type:'module'})
      this.worker.onmessage = ({data}) => {
        const done=this.pending.get(data.id); if(!done)return; this.pending.delete(data.id)
        if (!data.ok) { done(null); return }
        const result = collectDamagePreview(data.raw.affected)
        done(result)
      }
      this.worker.onerror=()=>this.destroy()
    }
    const id=++this.revision
    return new Promise(resolve=>{this.pending.set(id,resolve);this.worker!.postMessage({type:'compute',id,...input})})
  }
  destroy() { this.worker?.terminate(); this.worker=null; for(const done of this.pending.values())done(null);this.pending.clear() }
}
