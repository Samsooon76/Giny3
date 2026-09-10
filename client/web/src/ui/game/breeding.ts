import { useState } from 'react'
import type { CharacterHud } from '../../giny/types'
import type { BindingResolver } from '../official/types'
import type { Repeater } from '../official/repeaters'

const GROUPS: Record<string,string> = {level:'Niveaux',family:'Type',gen:'Génération',fertility:'Fertilité',gender:'Sexe',mood:'Sérénité',stats:'Statistiques',Type:'Couleurs',capacity:'Capacités'}
export function useBreeding(hud:CharacterHud|null) {
  const [tab,setTab]=useState(0)
  const [mode,setMode]=useState(0)
  const [closed,setClosed]=useState<string[]>(['gender'])
  const [query,setQuery]=useState('')
  const resolve:BindingResolver=(b,scope)=>{
    if(b==='tg_tabs') return { style: {display:'flex',flexDirection:'row',flexWrap:'wrap',width:'100%'} }
    if(b.startsWith('ctr_')&&b.endsWith('Filter'))return {hidden:false}
    if(b==='grid')return {style:{alignContent:'flex-start',overflowY:'auto'}}
    if(b==='ctr_dropZone')return {hidden:false,style:{border:'1px solid #77758f',borderRadius:3}}
    if(b==='storageWindow')return {style:{height:880},text:'Inventaire'}
    if(b==='header_titleLabel' && scope==='storageWindow')return {text:'Inventaire'}
    if(b==='window_background')return {style:{backgroundImage:'none',backgroundColor:'#1b1c30'}}
    if(b==='sv_stable')return {hidden:tab!==0}
    if(b==='sv_paddock')return {hidden:tab!==1}
    if(b==='tab_stable'||b==='tab_paddock')return {className:(b==='tab_stable'?tab===0:tab===1)?'activeTrue':'activeFalse',onClick:()=>setTab(b==='tab_stable'?0:1)}
    if(b.startsWith('ti_search'))return {text:query,placeholder:'Rechercher une monture',onInput:e=>setQuery(e.target.value)}
    if(b.startsWith('lbl_empty'))return {text:'',style:{height:0,minHeight:0}}
    if(b==='lbl_noItem')return {hidden:false,text:scope==='bl_paddock'?"Aucune monture à afficher dans l’enclos":'Déposez vos montures ici',style:{display:'flex',position:'absolute',inset:0,alignItems:'center',justifyContent:'center',whiteSpace:'normal'}}
    if(b==='lbl_stableCount')return {text:scope==='bl_paddock'?'0/10 montures':'0/250 montures'}
    if (['ctr_serenityGaugeMinus','ctr_serenityGaugePlus','ctr_gaugeEnergy','ctr_gaugeMaturity','ctr_gaugeLove','ctr_gaugeXp'].includes(b)) return {style:{background:'#2b2d4b',borderRadius:10,padding:'8px 10px'}}
    if(b==='da_breeding' && scope!=='bl_paddock')return {style:{border:'1px solid #77758f',borderRadius:3}}
    if(b==='lbl_gaugeCount')return {text:'0/2 jauges activées'}
    if(b.startsWith('pb_gauge'))return {value:0}
    if(b==='btn_genealogy')return {text:'GÉNÉTIQUE'}
    if(b==='btn_reset')return {text:'RÉINITIALISER',onClick:()=>{setQuery('');setClosed(['gender'])}}
    if(b==='lbl_kamas')return {text:String(hud?.kamas??0)}
    if(['estimatedValueTxt','podsPreviewTxt','btnCosmetic','btnQuest','btnConsumables','parentOptionalViews','parentTitlesOrnaments','parentInventories','parentEstimatedValue'].includes(b))return {hidden:true}
    if(b==='cb_category')return {text:'Toutes catégories'}
    if(b==='cb_sort')return {text:'Aucun tri'}
    if(b==='btn_checkCraft')return {text:'RECETTES'}
    return undefined
  }
  const filters:Repeater={}
  for(const [key,label]of Object.entries(GROUPS))for(const suffix of ['Stable','Paddock'])filters[`gf_${key}Filter${suffix}`]=[{key,template:'GenericFilterCategory',resolve:b=>{
    if(b==='filter_header')return {style:{borderTop:'1px solid #565572',fontSize:16},onClick:()=>setClosed(c=>c.includes(key)?c.filter(x=>x!==key):[...c,key])}
    if(b==='filter_title')return {text:label.toUpperCase()}
    if(b==='filter_toggle')return {text:closed.includes(key)?'+':'−'}
    if(b==='filter_options')return {hidden:closed.includes(key)}
    if(b==='filter_hint')return {text:key==='level'?'de   1     à   200':key==='mood'?'de   −5000     à   5000':key==='capacity'?"Aucune monture ne possède de capacité":"L’étable est vide",style:{padding:'4px 16px 16px',fontStyle:'italic',whiteSpace:'normal'}}
    return undefined
  }}]
  const repeaters:Repeater={...filters,ctr_paddock:[{key:'paddock',template:'PaddockUi',flowWindow:true,resolve,repeaters:{tgg_paddocks:[1,2,3,4,5,6].map(i=>({key:String(i),template:'DofusTab',resolve:b=>b==='tab_label'?{text:String(i)}:!b?{className:i===1?'activeTrue':'activeFalse',style:{width:28,height:32,background:i===1?'#626181':'#39394f',marginRight:4},disabled:i!==1}:undefined}))}}],tg_tabs:['ENCLOS','ACCOUPLEMENT','CLONAGE','EXTRACTION'].map((label,i)=>({key:String(i),template:'DofusTab',resolve:b=>b==='tab_icon'?{sprite:['paddock','mating','cloning','extraction'][i],hidden:false}:b==='tab_container'?{style:{flexDirection:'row',alignItems:'center',gap:8,width:'100%',height:'100%',padding:8}}:b==='tab_label'?{text:label,style:{fontSize:16}}:!b?{className:mode===i?'activeTrue':'activeFalse',style:{width:'50%',height:72,background:mode===i?'#626181':'#2c2d4b'},onClick:()=>setMode(i)}:undefined}))}
  return {resolve,repeaters}
}
