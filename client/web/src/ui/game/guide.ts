import type { CharacterHud } from '../../giny/types'
import { useState } from 'react'
import type { BindingResolver } from '../official/types'
import type { Repeater } from '../official/repeaters'
import { useReferenceCatalog } from './referenceCatalog'
import { itemIcon, item } from './catalog'
export function useGuide(active:boolean,hud?:CharacterHud|null){
  const data=useReferenceCatalog(active),[query,setQuery]=useState(''),[tab,setTab]=useState(0),[selection,setSelection]=useState<number>(),[hide,setHide]=useState(false),[sort,setSort]=useState(false),[type,setType]=useState('all')
  const rows=(data.dofusprogressions??[]).filter(r=>(!hide||!hud?.items.some(i=>item(i.gid)?.iconId===Number(r.gfxId)))&&r.name?.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))&&(type==='all'||(type==='primordial'?r.isPrimordial:r.isEvent))).sort((a,b)=>sort?(a.minLevel??0)-(b.minLevel??0):(a.order??0)-(b.order??0))
  const selected=rows.find(r=>r.id===selection)
  const resolve:BindingResolver=b=>{
    if(b==='header_titleLabel')return {text:'Aventure / Guide'}
    if(b==='ctr_temporisWarning')return {hidden:true}
    if(b==='inp_search')return {text:query,placeholder:'Recherche',onInput:e=>setQuery(e.target.value)}
    if(b==='dd_filter')return {text:type==='all'?'Tous les types':type==='primordial'?'Dofus primordiaux':'Événements',options:[{value:'all',label:'Tous les types'},{value:'primordial',label:'Dofus primordiaux'},{value:'event',label:'Événements'}],selectedOption:type,onSelect:setType}
    if(b==='btn_sort')return {onClick:()=>setSort(!sort)}
    if(b==='dofusprogress')return {style:{height:'100%',minHeight:0}}
    if(b==='ctr_content')return {style:{flex:1,minHeight:0,overflow:'hidden'}}
    if(b==='ctr_footer')return {hidden:false,style:{flexShrink:0,height:48}}
    if(b==='ctr_dofusContent')return {style:{display:'grid',gridTemplateColumns:'repeat(8,minmax(0,1fr))',gap:18,padding:20,alignContent:'start'}}
    if(b==='sv_dofus')return {hidden:!!selected,style:{height:'100%',overflowY:'auto'}}
    if(b==='ctr_dofusView')return {hidden:!selected}
    if(b==='lbl_noItem')return {hidden:rows.length>0,text:'Aucun Dofus ne correspond à la recherche.'}
    if(b==='tx_dofusDetail')return {sprite:selected?itemIcon({gid:0,icon_id:Number(selected.gfxId)}):undefined}
    if(b==='lbl_dofusName')return {text:selected?.name}
    if(b==='lbl_dofusDesc')return {text:selected?.description,style:{whiteSpace:'normal'}}
    if(b==='btn_closeDofusDisplay')return {onClick:()=>setSelection(undefined)}
    if(b==='chk_hideDofusCompleted')return {text:'Masquer les dofus obtenus',checked:hide,onClick:()=>setHide(!hide),className:'checkboxLine'}
    if(b==='chk_hideObjCompleted')return {hidden:!selected}
    if(b==='lbl_noPre')return {text:selected?.prerequisites?.length?'':'Aucun prérequis',hidden:!!selected?.prerequisites?.length}
    if(b==='lbl_noStep')return {hidden:!!selected?.steps?.length}
    return undefined
  }
  const repeaters:Repeater={
    'ctr-btn-tab':['DOFUS','SUGGESTIONS','GUIDE'].map((label,i)=>({key:String(i),template:'DofusTab',resolve:b=>b==='tab_label'?{text:label}:!b?{className:tab===i?'activeTrue':'activeFalse',onClick:()=>setTab(i)}:undefined})),
    'ctr-ui':[{key:String(tab),template:tab===0?'DofusProgressUi':tab===1?'gameSuggestion':'gameguideTab',resolve,repeaters:{ctr_dofusContent:rows.map(row=>({key:String(row.id),template:'DofusTile',resolve:b=>b==='ctr_dofusTile'?{style:{width:'100%',height:190,margin:0,background:'#202037',border:'2px solid #55536f',borderRadius:8},onClick:()=>setSelection(row.id)}:b==='lbl_name'?{text:row.name,style:{whiteSpace:'normal',textAlign:'center'}}:b==='lbl_level'?{text:`${row.minLevel} - ${row.maxLevel}`}:b==='tx_dofus'?{sprite:itemIcon({gid:0,icon_id:Number(row.gfxId)})}:b==='icon_link'?{hidden:!row.isPrimordial}:b==='icon_event'?{hidden:!row.isEvent}:b==='pb_progress'?{hidden:true}:undefined})),...Object.fromEntries(['lv_pre','lv_steps'].map(binding=>[binding,(binding==='lv_pre'?selected?.prerequisites:selected?.steps)?.map((step,i)=>({key:String(i),template:'quest_objective',resolve:(b:string)=>b==='lbl_objective'?{text:data.achievements?.find(a=>a.id===step.value)?.name??`Étape ${i+1} · ${step.value}`} :['ctr_questDescription','btn_description'].includes(b)?{hidden:true}:undefined}))??[]]))}}],
  };return {resolve,repeaters}
}
