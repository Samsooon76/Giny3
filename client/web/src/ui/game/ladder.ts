import { useState } from 'react'
import type { CharacterHud } from '../../giny/types'
import type { BindingResolver } from '../official/types'
import type { Repeater } from '../official/repeaters'
import { creationHeadSprite } from './creationBindings'
export function useLadder(hud:CharacterHud|null){
 const [tab,setTab]=useState(0),[query,setQuery]=useState('')
 const preview=new URLSearchParams(location.search).has('ui-preview')
 const rows=preview&&hud?[{...hud.character,rank:1,points:hud.experience.current}]:[]
 const line:BindingResolver=b=>b==='lbl_name'?{text:hud?.character.name}:b==='lbl_rank'?{text:'1'}:b==='lbl_breed'?{text:hud?.character.breed_name}:b==='lbl_server'?{text:'Giny'}:b==='lbl_level'?{text:String(hud?.character.level??0)}:b==='lbl_points'?{text:tab===2?String(hud?.achievement_points??0):(hud?.experience.current??0).toLocaleString('fr')}:b==='ic_class'?{sprite:creationHeadSprite(hud?.character.breed_id??1,'male')}:b==='omegaBackground'?{hidden:true}:undefined
 const resolve:BindingResolver=b=>{
  if(b==='inp_search')return {text:query,placeholder:'Rechercher un personnage',onInput:e=>setQuery(e.target.value)}
  if(b==='lbl_noContent')return {hidden:preview,text:'Le classement sera disponible après synchronisation avec le serveur.'}
  if(b==='ctr_topRanking'||b==='ctr_footer')return {hidden:!rows.length}
  if(b==='ctr_rankingSilver'||b==='ctr_rankingCopper'||b==='ic_refresh')return {hidden:true}
  if(b==='lbl_topPlayerNameGold')return {text:hud?.character.name}
  if(b==='pr_gold')return {sprite:creationHeadSprite(hud?.character.breed_id??1,'male')}
  return line(b)
 }
 const repeaters:Repeater={tabs:['GÉNÉRAL','KOLIZÉUM','SUCCÈS','ÉVÉNEMENTS KROSMIQUES','SONGES INFINIS','RAIDS'].map((label,i)=>({key:String(i),template:'DofusTab',resolve:b=>b==='tab_label'?{text:label}:!b?{className:tab===i?'activeTrue':'activeFalse',onClick:()=>setTab(i)}:undefined})),ctr_content:[{key:String(tab),template:'ExperienceAndAchievementLadderTab',resolve,repeaters:{lv_list:rows.filter(r=>r.name.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))).map(r=>({key:String(r.id),template:'ExperienceAndAchievementLadderLine',resolve:line}))}}]}
 return {resolve,repeaters}
}
