import { HUD_LAYOUT } from './hudLayout'
import type { Rect } from '../official/magnetism'
import type { CombatFighter } from '../../giny/combatState'
import type { BindingResolver } from '../official/types'
import type { Repeater } from '../official/repeaters'

let current: CombatFighter | null = null
const listeners = new Set<()=>void>()
export const combatTargetInfo = {
  subscribe(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener)}},
  snapshot:()=>current,
  set(fighter:CombatFighter|null){if(current===fighter)return;current=fighter;listeners.forEach(f=>f())},
}
const stat = (f:CombatFighter,id:number) => f.preview_stats ? f.preview_stats.find(s=>s.id===id)?.total ?? 0 : null
const value = (v:number|null|undefined) => v==null?'—':String(v)
/** The extracted FighterInfoTooltip is docked over the spell row while hovering. */
export function targetInfoLayer(f:CombatFighter, anchor:Rect=HUD_LAYOUT.ActionBar) {
  const resolve:BindingResolver=b=>{
    if(b==='fighterInfoTooltip')return {hidden:false,style:{position:'absolute',left:anchor.x,top:anchor.y+anchor.h-116,width:anchor.w,height:116,pointerEvents:'none',zIndex:100,backgroundColor:'var(--background_dark95)'}}
    if(b==='ctr_left')return {style:{width:'100%'}}
    if(b==='ctr_entityAndStats')return {style:{flexDirection:'row',height:116}}
    if(b==='ctr_entity')return {style:{width:280,padding:8,flexShrink:0}}
    if(b==='ctr_stats')return {style:{width:355,padding:8,flexGrow:1}}
    if(b==='ctr_statLine12')return {style:{gap:3}}
    if(['ctr_right','ctr_toggles','ctr_buffSpells','btn_closePin','ic_breed','lbl_koliServer','tx_lifeThreshold','lbl_lifeThreshold','tx_ip','lbl_ip'].includes(b))return {hidden:true}
    if(b==='lbl_name')return {text:f.name}
    if(b==='entityPortrait')return {look:f.look,lookMode:f.breed?'portrait':'fit',lookStatic:true,style:{width:66,height:72,flexShrink:0}}
    if(b==='lbl_lvl')return {text:`Niv. ${f.level}`}
    if(b==='lbl_currentLife')return {text:String(f.life)}
    if(b==='lbl_totalLife')return {text:`/ ${f.max_life}`}
    if(b==='lbl_currentLifePercent')return {text:`(${Math.round(f.life/Math.max(1,f.max_life)*100)}%)`}
    if(b==='lbl_shield')return {text:String(f.shield)}
    if(b==='lbl_pa')return {text:String(f.ap)}
    if(b==='lbl_pm')return {text:String(f.mp)}
    if(b==='lbl_permanentDamage')return {text:stat(f,75)==null?'—':`${stat(f,75)}%`}
    const icon=({tx_life:'tx_health',tx_shield:'tx_healthShield',tx_pa:'tx_actionPoints',tx_pm:'tx_movementPoints',tx_permanentDamage:'tx_erosion'} as Record<string,string>)[b]
    if(icon)return {sprite:`/dofus3/characteristics/${icon}.png`}
    return undefined
  }
  const item=(key:string,id:number,icon:string,percent=false,color?:string,flat?:number)=>({key,template:'FighterInfoStat',resolve:((b:string)=>{
    if(b==='fighterInfoStat')return {style:{width:63,minWidth:0}}
    if(b==='tx_icon')return {sprite:`/dofus3/characteristics/${icon}.png`,style:{opacity:stat(f,id)?1:.4}}
    const raw=stat(f,id), displayed=raw!=null&&[121,124,141,142].includes(id)?100-raw:raw
    if(b==='lbl_resValuePercent')return {hidden:!percent,text:displayed==null?'—':`${displayed}%`,style:{fontSize:12,color}}
    if(b==='lbl_resValue')return {hidden:percent&&flat==null,text:value(stat(f,flat??id)),style:{fontSize:12,color}}
    return undefined
  }) as BindingResolver})
  const repeaters:Repeater={
    ctr_statLine1:[item('tackle',79,'tx_tackle'),item('dodgeAP',27,'tx_dodgeAP'),item('critical',87,'tx_criticalReduction'),item('spell',141,'tx_spellsRes',true),item('weapon',142,'tx_weaponRes',true)],
    ctr_statLine2:[item('evade',78,'tx_escape'),item('dodgeMP',28,'tx_dodgeMP'),item('push',85,'tx_pushReduction'),item('distance',121,'tx_distanceRes',true),item('melee',124,'tx_resMelee',true)],
    ctr_statLine3:[item('neutral',37,'tx_neutralRes',true,'#c3b9ad',58),item('earth',33,'tx_strengthRes',true,'#b99b58',54),item('fire',34,'tx_intelligenceRes',true,'#e98466',55),item('water',35,'tx_chanceRes',true,'#69b6d2',56),item('air',36,'tx_agilityRes',true,'#b7cb68',57)],
  }
  return {tree:'FighterInfoTooltip',resolve,repeaters}
}
