import { nativeSpellPlan, legacySpellPlan } from './bubbleSpellSequences'
import type { BubbleSpellStep } from './bubbleSpellSequences'
import { spell, spellLevel } from '../../ui/game/catalog'
import { getSpellScript, resolveAttackAnimKinds } from './spellScripts'
export type CastAction = { spell_id: number; grade?: number; critical?: boolean; type?: string; script_id?: number }
export type SpellVisual = {
  type: 'cast' | 'target' | 'caster' | 'mark' | 'projectile' | 'trail'
  casterAnimation?: string; gfxAnimationEndPolicy?: 'beginning' | 'shot' | 'end' | 'sameAsSequence'
  gfxId?: number; directionType?: 'normal' | 'random' | 'oriented'; strata?: 'front' | 'background' | 'highest'
  offsetY?: number; scaleX?: number; scaleY?: number; frameOffset?: number
  speed?: number; curvature?: number; isCurveFollowed?: boolean; isCasterOriented?: boolean
}
export type SpellSequence = { gfxs: SpellVisual[]; endPolicy?: 'waitForAll' | 'waitForFirstOne' | 'dontWait'; native?: BubbleSpellStep[] }
/** Giny/catalog adapter. Native JSON sequences are parsed by the imported Bubble planner. */
export function spellSequences(action: CastAction, breed: number, sourceCellId = 0, targetCellId = 0, cellsData: { l: number }[] = []): SpellSequence[] {
  const definition = spell(action.spell_id)
  if (spellLevel(action.spell_id, action.grade ?? 1)?.playAnimation === false) return []
  if (action.type === 'weapon') return [{ gfxs: [{ type: 'cast', casterAnimation: resolveAttackAnimKinds(action, breed)[0], gfxAnimationEndPolicy: 'end' }] }]
  const usages = action.critical ? definition?.criticalHitBoundScriptUsageData : definition?.boundScriptUsageData
  const selected = [...(usages ?? [])].filter(u => !u.spellLevels?.length || u.spellLevels.includes(action.grade ?? 1)).sort((a,b)=>(a.order??0)-(b.order??0))
  const ids = selected.length ? selected.map(u=>u.scriptId) : [action.script_id ?? (action.critical ? definition?.scriptIdCritical : definition?.scriptId)].filter((id): id is number => !!id)
  const result: SpellSequence[] = []
  for (const id of ids) {
    const script = getSpellScript(id)
    if (!script) continue
    if (script.type === 9) {
      const native = nativeSpellPlan({ scriptId: id, spellId: action.spell_id, scriptData: script, sourceCellId, targetCellId, cellsData, spellLevelDef: { effects: spellLevel(action.spell_id, action.grade ?? 1)?.effects ?? [] } })
      result.push({ gfxs: [], native })
      continue
    }
    if (script.type===1 || script.type===2) {
      const legacy=legacySpellPlan({scriptId:id,spellId:action.spell_id,scriptData:script,sourceCellId,targetCellId})
      result.push({gfxs:[],native:legacy.map(step=>{
        if(step.kind==='caster-animation')return {...step,kind:'native-caster-animation' as const,
          animationName:resolveAttackAnimKinds({...action,script_id:id},breed)[0],endPolicy:'shot' as const}
        if(step.kind==='gfx-entity')return {...step,kind:'native-gfx-entity' as const,scaleX:1,scaleY:1,frameOffset:0}
        return step
      })})
    } else {
      console.warn(`[combat-animation] Type de script officiel non pris en charge : ${script.type} (sort ${action.spell_id})`)
    }

  }
  return result.length ? result : [{ gfxs: [{ type: 'cast', casterAnimation: resolveAttackAnimKinds(action, breed)[0], gfxAnimationEndPolicy:'end' }] }]
}
