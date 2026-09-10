import { useState } from 'react'
import type { CharacterHud } from '../../giny/types'
import type { BindingResolver } from '../official/types'
import type { Repeater } from '../official/repeaters'
import { useReferenceCatalog } from './referenceCatalog'
import { previewAchievementCategories, achievementIcon } from './catalog'
export function useAchievements(active:boolean,hud:CharacterHud|null){
 const data=useReferenceCatalog(active),[query,setQuery]=useState(''),[category,setCategory]=useState(0),[account,setAccount]=useState(false)
 const categories=previewAchievementCategories(),all=data.achievements??[]
 const needles=['Apéwicubes','Aurore Pourpre','Antre du Korriandre','Goulet du Rasboul','La cité blanche','Terre des novices']
 const selected=needles.map(n=>all.find(r=>r.name?.includes(n))).filter((r):r is NonNullable<typeof r>=>!!r)
 const rows=(category||query||!new URLSearchParams(location.search).has('ui-preview')?all:selected.length?selected:all).filter(r=>(!category||r.categoryId===category)&&r.name?.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))).slice(0,40)
 const resolve:BindingResolver=b=>{
  if(b==='inp_search')return {text:query,placeholder:'Rechercher…',onInput:e=>setQuery(e.target.value)}
  if(b==='switch_tab')return {checked:!account,onClick:()=>setAccount(!account)}
  if(b==='lbl_myPoints')return {style:{fontSize:48,color:'#e0bb72',height:70},text:String(hud?.achievement_points??0)}
  if(['ctr_base','ctr_endingAchievements'].includes(b))return {hidden:false}
  if(['ctr_summary','ctr_achievements','ctr_noEndingAchievement','ctr_footerTab'].includes(b))return {hidden:true}
  if(b==='ctr_endingAchievementContent')return {style:{display:'flex',flexDirection:'row',flexWrap:'wrap',gap:18,padding:20,alignContent:'flex-start'}}
  if(b==='gd_endingAchievements')return {style:{height:'100%',overflowY:'auto'}}
  return undefined
 }
 const repeaters:Repeater={gd_categories:[{key:'all',template:'GenericFilterCategory',resolve:b=>b==='filter_title'?{text:'PROGRESSION GÉNÉRALE'}:b==='filter_header'?{onClick:()=>setCategory(0)}:['filter_options','filter_toggle'].includes(b)?{hidden:true}:undefined},...categories.map(c=>({key:String(c.id),template:'GenericFilterCategory',resolve:(b:string)=>b==='filter_title'?{text:c.name??''}:b==='filter_header'?{onClick:()=>setCategory(c.id),style:{height:42,background:category===c.id?'#777598':undefined}}:b==='filter_toggle'?{text:'+'}:b==='filter_options'?{hidden:true}:undefined}))],ctr_endingAchievementContent:rows.map(r=>({key:String(r.id),template:'endingAchievementsItem',resolve:b=>b==='ctr_card'?{style:{width:'calc(50% - 9px)',height:220,background:'#2b2d4b',borderRadius:10}}:b==='ctr_header'?{text:categories.find(c=>c.id===r.categoryId)?.name??'SUCCÈS'}:b==='lbl_cardName'?{text:r.name,style:{whiteSpace:'normal'}}:b==='lbl_cardDescription'?{text:r.description,style:{whiteSpace:'normal'}}:b==='tx_cardPicture'?{sprite:achievementIcon(r.iconId)}:b==='lbl_cardMoreObjectives'?{hidden:(r.objectiveIds?.length??0)<=3,text:`+ ${Math.max(0,(r.objectiveIds?.length??0)-3)} AUTRES`}:undefined,repeaters:{gd_cardObjectives:(r.objectiveIds??[]).slice(0,3).map(id=>({key:String(id),template:'achievementCheckbox',resolve:b=>b==='achievementCheckbox'?{style:{height:28,minHeight:28,width:'100%',flexShrink:0}}:b==='lbl_achievement'?{text:data.achievementobjectives?.find(o=>o.id===id)?.name??'',style:{whiteSpace:'normal',fontSize:14}}:b==='checkbox'?{checked:false}:undefined}))}}))}
 return {resolve,repeaters}
}
