import { combatTargetInfo } from './combatTargetInfo'
import { createElement } from 'react'
import { tooltipStore } from '../official/tooltipStore'
import type { CombatFighter } from '../../giny/combatState'
import type { BindingResolver } from '../official/types'
import type { Repeater } from '../official/repeaters'
import type { DamagePreview } from '../../game/combat/SpellDamagePreview'

// Element IDs are Bubble's damageRange.elemId, not protocol action IDs.
const elements = [ ['tx_neutral','#c3b9ad'], ['tx_strength','#b99b58'], ['tx_intelligence','#e98466'], ['tx_agility','#b7cb68'], ['tx_chance','#69b6d2'] ]
function damageRows(fighter: CombatFighter, damage: DamagePreview | null | undefined): Repeater {
  const rows = damage?.filter(r=>r.id===fighter.id) ?? []
  const groups = rows.filter((r,i)=>rows.findIndex(v=>v.element===r.element&&v.heal===r.heal)===i)
  return { damagesList: groups.map(group=>({key:`${group.element}:${group.heal}`,template:'DamageElement',resolve:b=>{
    if(b==='divider')return {hidden:true}
    if(b==='root')return {style:{marginTop:0}}
    if(b!=='lbl_damage')return undefined
    const normal=rows.find(r=>r.element===group.element&&r.heal===group.heal&&!r.critical)
    const critical=rows.find(r=>r.element===group.element&&r.heal===group.heal&&r.critical)
    const [icon,color]=group.heal?['tx_heal','#a8cf64']:elements[group.element]??['tx_neutral','#fff']
    const range=(r:DamagePreview[number])=>`${group.heal?'+ ':''}${r.min} - ${r.max}`
    const glyph=()=>createElement('img',{src:`/dofus3/characteristics/${icon}.png`,alt:icon,style:{width:14,height:14,objectFit:'contain'}})
    return {text:'',replaceChildren:true,children:createElement('span',{style:{display:'inline-flex',justifyContent:'center',alignItems:'center',gap:4,color}},normal&&range(normal),normal&&glyph(),critical&&`(${range(critical)}`,critical&&glyph(),critical&&')'),style:{display:'flex',justifyContent:'center',width:'100%'}}
  }})) }
}
export function fighterTooltipResolver(fighter: CombatFighter, damage: DamagePreview | null | undefined): BindingResolver {
  return binding => {
    if (['ctr_pings','tx_status','inlineSeparator','ctr_inlineVitals','thresholdGauge','healthPreviewMaxGauge','healthPreviewMinGauge','shieldPreviewMaxGauge','shieldPreviewMinGauge','ctr_states','lbl_fightStatus','lbl_unsortedInfo','lbl_info'].includes(binding)) return { hidden:true }
    if(binding==='background')return {style:{width:216,minWidth:216,flexShrink:0}}
    if(binding==='lbl_name')return {text:fighter.name}
    if(binding==='lbl_heathValue')return {text:`${fighter.life} (${Math.round(100*fighter.life/Math.max(1,fighter.max_life))}%)`,style:{justifyContent:'center',textAlign:'center'}}
    if(binding==='healthGauge')return {style:{backgroundColor:'#ed7895',width:`${Math.max(0,Math.min(100,100*fighter.life/Math.max(1,fighter.max_life)))}%`}}
    if(binding==='shieldGauges')return {hidden:!fighter.shield}
    if(binding==='shieldGauge')return {style:{width:'100%'}}
    if(binding==='lbl_shieldValue')return {text:String(fighter.shield)}
    if(binding==='damagesList')return {hidden:!damage?.some(r=>r.id===fighter.id),style:{gap:0}}
    return undefined
  }
}
export function hideCombatTargetTooltip() { combatTargetInfo.set(null); tooltipStore.hide('combat-target') }
export function showCombatTargetTooltip(fighters: CombatFighter[], damage: DamagePreview | null | undefined, point: {x:number;y:number}) {
  if(!fighters.length){hideCombatTargetTooltip();return}
  combatTargetInfo.set(fighters[0])
  const surface=document.querySelector<HTMLElement>('.official-canvas')
  if(!surface)return
  const rect=surface.getBoundingClientRect(), scale=rect.width/1920
  // The official TooltipManager stacks one PlayerFighterTooltip per affected
  // entity. Each copy retains the parsed frame, health gauge and DamageElement.
  tooltipStore.show({tree:'PlayerFighterTooltip',delay:0,source:'combat-target',placement:'above-center',
    resolve:b=>b==='background'?{style:{backgroundColor:'transparent',padding:0,gap:4,width:216}}:undefined,
    repeaters:{background:fighters.map(f=>({key:String(f.id),template:'PlayerFighterTooltip',resolve:fighterTooltipResolver(f,damage),repeaters:damageRows(f,damage)}))},
    rect:{x:(point.x-rect.left)/scale,y:(point.y-rect.top)/scale,w:0,h:0}})
}
