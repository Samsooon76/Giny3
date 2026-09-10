import { useState } from 'react'
import type { BindingResolver } from '../official/types'
import type { Repeater } from '../official/repeaters'
import { useReferenceCatalog } from './referenceCatalog'
import { spell, spellIcon, spellLevelById } from './catalog'
import { SpellTooltipBuilder } from './tooltipBuilders'
export function companionStat(ranges:Array<{values:number[]}>|undefined,level:number){
  let previous=1,total=0
  for(const {values:[end,amount]} of ranges??[]){
    if(end===1)total+=amount
    else total+=Math.max(0,Math.min(level,end)-previous)*amount
    previous=Math.max(previous,end)
  }
  return Math.floor(total+1e-4)
}
export function useCompanions(active:boolean){
  const data=useReferenceCatalog(active),[selection,setSelection]=useState(1)
  const rows=data.companions??[],selected=rows.find(r=>r.id===selection)??rows[0]
  const resolve:BindingResolver=b=>{
    if(b==='header_titleLabel')return {text:'Compagnons'}
    if(b==='Companions')return {style:{width:1330,height:1010}}
    if(b==='sv_companionList')return {style:{display:'grid',gridTemplateColumns:'repeat(3, minmax(0, 1fr))',alignContent:'start',gap:12,padding:8,overflowY:'auto'}}
    if(b==='lbl_name')return {text:selected?.name??''}
    if(b==='lbl_level')return {text:'NIV.'}
    if(b==='lbl_levelValue')return {text:'200'}
    if(b==='lbl_lore')return {text:selected?.description??'',style:{whiteSpace:'normal',fontStyle:'italic',height:'auto'}}
    if(b==='btn_equip')return {text:'ÉQUIPER',disabled:true,tooltip:{tree:'TextTooltip',text:'Ce compagnon doit être possédé pour être équipé.'}}
    if(b==='tx_illu')return {sprite:selected?`/game-data/client/illustrations/companions/big_${selected.assetId}.png`:undefined,style:{width:'40%',height:420,overflow:'visible',backgroundSize:'contain',borderRadius:8}}
    if(b==='ctr_entityStatsDetailed')return {style:{position:'relative',left:0,top:0,width:'100%',height:'100%'}}
    if(b==='ctr_companionStatsDetailed')return {style:{display:'flex',flexDirection:'row',flexWrap:'wrap',gap:4}}
    if(b==='sv_spells')return {style:{flexDirection:'row',flexWrap:'wrap',gap:12,alignContent:'flex-start'}}
    return undefined
  }
  const value=(id:number)=>companionStat(data.companioncharacteristics?.find(r=>r.companionId===selected?.id&&r.caracId===id)?.statPerLevelRange,200)
  const ids=[0,25,1,26,23,79,78,82,27,83,28,48]
  const stats=[['Points de vie','tx_health'],['Puissance','tx_damagesPercent'],['PA','tx_actionPoints'],['Invocation','tx_summonableCreaturesBoost'],['PM','tx_movementPoints'],['Tacle','tx_tackle'],['Fuite','tx_escape'],['Retrait PA','tx_attackAP'],['Esquive PA','tx_dodgeAP'],['Retrait PM','tx_attackMP'],['Esquive PM','tx_dodgeMP'],['Prospection','tx_prospecting']]
  const repeaters:Repeater={
    sv_companionList:rows.map(r=>({key:String(r.id),template:'companionElement',resolve:(b:string)=>b==='slot_companion'?{look:r.look,lookMode:'fit',lookStatic:true,onClick:()=>setSelection(r.id),style:{width:'100%',height:100,margin:0,backgroundColor:'#2b2d46',borderRadius:10,boxShadow:r.id===selection?'inset 0 0 0 2px #b6b3e6':undefined}}:undefined})),
    ctr_companionStatsDetailed:[...stats.map(([label,icon],i)=>({key:String(i),template:'statTwoColumnsItem',resolve:(b:string)=>b==='ctr_stat'?{style:{width:'calc(50% - 6px)',height:28}}:b==='lbl_statName'?{text:label}:b==='tx_stat'?{sprite:icon}:b==='lbl_statValue'?{text:String(value(ids[i])+(i===0?value(11):0))}:undefined})),{key:'table',template:'EntityStatsTable',resolve:(b:string)=>b==='ctr_entityStatsTable'?{style:{width:'100%',marginTop:8}}:undefined,repeaters:{ctr_entityStatsTableItems:['Neutre','Terre','Feu','Eau','Air','Critiques','Poussée'].map((label,i)=>({key:String(i),template:'EntityStatsTableItem',resolve:(b:string)=>b==='ctr_statsTableItem'?{style:{height:24,minHeight:24}}:b==='lbl_statName'?{text:label,style:{fontSize:14}}:b==='tx_stat'?{sprite:['tx_neutral','tx_strength','tx_intelligence','tx_chance','tx_agility','tx_criticalDamage','tx_push'][i]}:b==='lbl_damageValue'?{text:String(i===6?value(84):0)}:b==='lbl_resFixValue'?{text:'0'}:b==='lbl_resPercentValue'?{text:i<5?`${value([37,33,34,35,36][i])} %`:'—'}:undefined}))}}],
    sv_spells:[...(selected?.startingSpellLevelId ? [-selected.startingSpellLevelId] : []),...(selected?.spells??[])].map(id=>{const row=data.companionspells?.find(r=>r.id===id),s=spell(id<0 ? spellLevelById(-id)?.spellId??0 : row?.spellId??id);return {key:String(id),template:'commonSpell',resolve:(b:string)=>b==='lbl_commonSpellName'?{text:s?.name??''}:b==='slot_commonSpell'?{sprite:spellIcon(s?.iconId)}:b==='commonSpell'?{tooltip:SpellTooltipBuilder.Build({id:s?.id??id,name:s?.name??'',grade:1,icon_id:s?.iconId}),style:{width:'calc(33.333% - 8px)',height:52,background:'#626181',border:'1px solid #aaa7c8',borderRadius:8}}:['ctr_obtainingLevels','tx_commonSpellNotKnown','tx_isSelectedCommonSpell','lbl_commonSpellType'].includes(b)?{hidden:true}:undefined}}),
  };return {resolve,repeaters}
}
