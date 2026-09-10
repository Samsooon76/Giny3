import { useState } from 'react'
import type { CharacterHud } from '../../giny/types'
import type { BindingResolver } from '../official/types'
import type { Repeater } from '../official/repeaters'
import { job, jobIcon } from './catalog'
export function useProfile(hud:CharacterHud|null){
 const [tab,setTab]=useState(0)
 const resolve:BindingResolver=b=>{
  if(b==='header_titleLabel')return {text:'Mon profil'}
  if(b==='ctr_charac'||b==='ctr_offline'||b==='tooltipSource')return {hidden:true}
  if(b==='ctr_entity')return {sprite:'styles/images/socle_1.png',style:{backgroundSize:'65% auto',backgroundPosition:'center 80%'}}
  if(['btn_success','btn_guild','btn_alliance','btn_alignment','btn_house','btn_lover'].includes(b))return {className:'playerInfoBtn',style:{width:110,height:120,marginBottom:12,background:'#30314c',border:'1px solid #55556d',borderRadius:8}}
  if(b==='tx_alignment')return {hidden:false,sprite:'alignment',style:{width:42,height:42}}
  if(b==='tx_house')return {hidden:false,sprite:'houseGrey',style:{width:42,height:42}}
  if(b==='tx_lover')return {hidden:false,sprite:'tx_health',style:{width:42,height:42}}
  if(b.startsWith('btn_no'))return {hidden:true}
  if(b==='entityDisplayer')return {look:hud?.character.look,lookMode:'fit'}
  if(b==='btn_contact')return {text:'PARTAGER',disabled:true}
  if(b==='lbl_name')return {text:hud?.character.name??''}
  if(b==='lbl_title')return {hidden:true}
  if(b==='lbl_level')return {text:'NIV.'}
  if(b==='lbl_levelValue')return {text:String(hud?.character.level??1)}
  if(b==='lb_className')return {text:hud?.character.breed_name.toUpperCase()}
  if(b==='tx_classIcon')return {sprite:`/game-data/client/class-icons/symbol_${hud?.character.breed_id??1}.png`}
  if(b==='tx_omega')return {hidden:true}
  if(b==='lbl_successScore')return {text:String(hud?.achievement_points??0)}
  if(b==='lbl_guildName')return {text:hud?.guild?.name??''}
  if(b==='btn_noGuild')return {hidden:!!hud?.guild}
  if(b==='lbl_noJob')return {hidden:!!hud?.jobs.length,text:'Choisissez des métiers à afficher'}
  if(b==='btn_editBackground')return {text:'FOND',disabled:true}
  if(b.startsWith('lbl_job'))return {text:String(hud?.jobs[Number(b.slice(-1))-1]?.level??'')}
  if(b.startsWith('tx_job')){const live=hud?.jobs[Number(b.slice(-1))-1],row=live?job(live.id):undefined;return {hidden:!live,sprite:jobIcon(row?.iconId,row?.picto)}}
  if(b.startsWith('ctr_job'))return {hidden:!hud?.jobs[Number(b.slice(-1))-1]}
  if(['lbl_loverName','lbl_allianceName','lbl_alignment','lbl_alignmentRank','lbl_subArea','lbl_coord'].includes(b))return {text:''}
  return undefined
 }
 const repeaters:Repeater={tabg_tabs:['GÉNÉRAL','ÉQUIPEMENT','CLASSEMENT'].map((label,i)=>({key:String(i),template:'DofusTab',resolve:b=>b==='tab_label'?{text:label}:!b?{className:tab===i?'activeTrue':'activeFalse',onClick:()=>setTab(i)}:undefined})),ctr_tabContent:[{key:String(tab),template:['PlayerInfoMain','PlayerInfoEquipment','PlayerInfoRanking'][tab],resolve}]}
 return {resolve,repeaters}
}
