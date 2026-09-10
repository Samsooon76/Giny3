import { useState } from 'react'
import type { CharacterHud } from '../../giny/types'
import type { BindingResolver } from '../official/types'
import type { Repeater, RepeaterItem } from '../official/repeaters'
import { previewQuests, questCategories, questObjectives, questStepDescription, itemIcon } from './catalog'

export function useQuests(hud: CharacterHud | null) {
  const [query,setQuery]=useState('')
  const [tab,setTab]=useState(hud?.quests[0]?.completed ? 1 : 0)
  const [minimum,setMinimum]=useState('1')
  const [maximum,setMaximum]=useState('200')
  const [selection,setSelection]=useState<number>()
  const [hidden,setHidden]=useState<number[]>([])
  const [unfollowed,setUnfollowed]=useState<number[]>([])
  const [collapsed,setCollapsed]=useState<number[]>([])
  const catalog=previewQuests(10000)
  const rows=(hud?.quests??[]).filter(q=>(tab===0?!q.completed&&!hidden.includes(q.id):tab===2?hidden.includes(q.id):!!q.completed)&&q.name.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')) && (catalog.find(r=>r.id===q.id)?.levelMin??1)>=Number(minimum||1) && (catalog.find(r=>r.id===q.id)?.levelMin??1)<=Number(maximum||200))
  const selected=rows.find(q=>q.id===selection)??rows[0]
  const current=selected?.id
  const group=new Map<number,typeof rows>()
  for(const q of rows){const category=catalog.find(r=>r.id===q.id)?.categoryId??0;group.set(category,[...(group.get(category)??[]),q])}
  const resolve: BindingResolver=b=>{
    if(b==='ti_searchQuest')return {text:query,placeholder:'Rechercher une quête',onInput:e=>setQuery(e.target.value)}
    if(b==='lbl_questTitle')return {text:selected?.name??''}
    if(b==='lbl_questDescription')return {text:current?questStepDescription(current)??'':'',style:{whiteSpace:'normal',height:'auto',overflow:'visible',fontStyle:'italic'}}
    if(b==='drop_steps'||b==='lbl_objectives')return {hidden:true}
    if(b==='ctr_description'||b==='footer')return {hidden:!selected}
    if(b==='lbl_emptyList')return {hidden:rows.length>0,text:'Aucune quête dans cette catégorie'}
    if(b==='btn_hide')return {text:hidden.includes(current??-1)?'AFFICHER':'MASQUER',onClick:()=>current&&setHidden(ids=>ids.includes(current)?ids.filter(id=>id!==current):[...ids,current])}
    if(b==='btn_follow')return {text:unfollowed.includes(current??-1)?'SUIVRE':'NE PLUS SUIVRE',onClick:()=>current&&setUnfollowed(ids=>ids.includes(current)?ids.filter(id=>id!==current):[...ids,current])}
    if(b==='ctr_kamasXp')return {hidden:!selected?.rewards}
    if(b==='lbl_kamas')return {hidden:!selected?.rewards,text:selected?.rewards?.kamas.toLocaleString('fr')}
    if(b==='lbl_xp')return {hidden:!selected?.rewards,text:selected?.rewards?.experience.toLocaleString('fr')}
    if(b==='lbl_rewards')return {text:'Récompenses'}
    if(b==='Min')return {hidden:false,text:minimum,onInput:e=>setMinimum(e.target.value),style:{width:76,height:32}}
    if(b==='Max')return {text:maximum,onInput:e=>setMaximum(e.target.value),style:{width:76,height:32}}
    if(b==='lbl_from')return {text:'Niveau'}
    if(b==='lbl_to')return {text:'à'}
    if(b==='btn_help')return {hidden:true}
    return undefined
  }
  const list:RepeaterItem[]=[]
  for(const [id,quests] of group){
    list.push({key:`category-${id}`,template:'quest',resolve:b=>b==='lbl_questName'?{text:`${questCategories().find(r=>r.id===id)?.name??'Quêtes'} (${quests.length})`}:b==='sectionHeaderContent'?{onClick:()=>setCollapsed(c=>c.includes(id)?c.filter(x=>x!==id):[...c,id])}:['lbl_questLevel','btn_follow'].includes(b)?{hidden:true}:undefined})
    if(collapsed.includes(id))continue
    list.push(...quests.map(q=>({key:String(q.id),template:'quest',resolve:((b:string)=>{
      if(b==='sectionHeaderContent')return {className:'quest',onClick:()=>setSelection(q.id),style:{background:q.id===current?'#595b7e':undefined,paddingLeft:40}}
      if(b==='lbl_questName')return {text:q.name}
      if(b==='lbl_questLevel')return {hidden:false,style:{color:'#d7ec54'},text:`Niv.${catalog.find(r=>r.id===q.id)?.levelMin??1}`}
      if(b==='btn_follow')return {hidden:false,checked:!unfollowed.includes(q.id)}
      return undefined
    })})))
  }
  const repeaters:Repeater={ctn_slots:(selected?.rewards?.items??[]).map(r=>({key:String(r.gid),template:'EncyclopediaLootSlot',resolve:b=>b==='loot_slot'?{sprite:itemIcon({gid:r.gid}),quantity:r.quantity}:undefined})),lv_questList:list,tbg_tabs:['En cours','Terminées','Masquées'].map((label,i)=>({key:String(i),template:'DofusTab',resolve:b=>b==='tab_label'?{text:`${label} (${i===0?(hud?.quests??[]).filter(q=>!q.completed&&!hidden.includes(q.id)).length:i===2?hidden.length:(hud?.quests??[]).filter(q=>q.completed).length})`}:!b?{className:tab===i?'activeTrue':'activeFalse',onClick:()=>setTab(i)}:undefined})),gd_objectives:(current?questObjectives(current):[]).filter(o=>!selected?.objectiveIds||selected.objectiveIds.includes(o.id)).map(o=>({key:String(o.id),template:'quest_objective',resolve:b=>b==='lbl_objective'?{text:o.text}:b==='ctr_questDescription'||b==='btn_description'?{hidden:true}:undefined}))}
  return {resolve,repeaters}
}
