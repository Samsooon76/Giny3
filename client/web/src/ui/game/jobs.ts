import { useState } from 'react'
import type { CharacterHud } from '../../giny/types'
import type { BindingResolver } from '../official/types'
import type { Repeater } from '../official/repeaters'
import { windowRepeaters } from './hudRepeaters'
import { recipesForJob, item } from './catalog'
export function useJobs(hud:CharacterHud|null){
 const [selection,setSelection]=useState<number>(),[query,setQuery]=useState(''),[maximum,setMaximum]=useState('200'),[minimum,setMinimum]=useState('1'),[resources,setResources]=useState(false),[conditioned,setConditioned]=useState(true),[possible,setPossible]=useState(false),[expanded,setExpanded]=useState<number[]>([])
 const selected=hud?.jobs.find(j=>j.id===selection)??hud?.jobs[0]
 const reordered=hud?{...hud,jobs:selected?[selected,...hud.jobs.filter(j=>j.id!==selected.id)]:hud.jobs}:null
 const source=reordered?windowRepeaters('jobUI',reordered)??{}:{}
 const recipes=recipesForJob(selected?.id??0)
 const entries=(source.lv_recipe??[]).filter(r=>{const row=recipes.find(v=>String(v.resultId)===r.key);return row?.name?.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))&&(row.resultLevel??1)>=Number(minimum)&&(row.resultLevel??1)<=Number(maximum)&&(conditioned||!item(row.resultId)?.criteria)&&(!possible||(row.ingredientIds??[]).every((gid,i)=>(hud?.items.filter(item=>item.gid===gid).reduce((sum,item)=>sum+item.quantity,0)??0)>=(row.quantities?.[i]??1)))})
 const resolve:BindingResolver=b=>{
  if(b==='tab_recipe'||b==='tab_skill')return {className:(b==='tab_recipe'?!resources:resources)?'activeTrue':'activeFalse',onClick:()=>setResources(b==='tab_skill')}
  if(b==='recipesUI')return {hidden:resources}
  if(b==='jobSkillsUI')return {hidden:!resources}
  if(b==='inp_search')return {text:query,placeholder:'Rechercher…',onInput:e=>setQuery(e.target.value)}
  if(b==='inp_lvlFrom')return {text:minimum,onInput:e=>setMinimum(e.target.value)}
  if(b==='inp_lvlTo')return {text:maximum,onInput:e=>setMaximum(e.target.value)}
  if(b==='lbl_nbRecipes')return {hidden:false,text:`${entries.length} Recettes`}
  if(b==='dpd_sort')return {text:'Niveau le plus élevé'}
  if(b==='dpd_missingIngredients')return {text:'Tous les ingrédients manquants'}
  if(b==='chb_condionnedCraft')return {checked:conditioned,onClick:()=>setConditioned(!conditioned)}
  if(b==='chb_possibleOnlyCraft')return {checked:possible,onClick:()=>setPossible(!possible)}
  return undefined
 }
 const repeaters:Repeater={...source,lv_recipe:entries.map(entry=>({...entry,resolve:(b,scope)=>{const recipe=recipes.find(r=>String(r.resultId)===entry.key);const index=Number(b.match(/^tile(\d+)$/)?.[1]??0)-1; if(index>=0&&recipe?.ingredientIds?.[index]){const gid=recipe.ingredientIds[index],quantity=recipe.quantities?.[index]??1,owned=hud?.items.filter(i=>i.gid===gid).reduce((n,i)=>n+i.quantity,0)??0;return {quantity,style:{background:'#1b1d33',border:owned<quantity?'1px solid #be886d':'1px solid #55516a'},tooltip:{tree:'TextTooltip',text:`${item(gid)?.name??''} : ${owned} / ${quantity}`}}}return entry.resolve(b,scope)}})),lv_jobProgress:(source.lv_jobProgress??[]).sort((a,b)=>(hud?.jobs.findIndex(j=>String(j.id)===a.key)??0)-(hud?.jobs.findIndex(j=>String(j.id)===b.key)??0)).map(row=>({...row,resolve:(b,s)=>{
  if(b==='jobProgressItem')return {style:{border:row.key===String(selected?.id)?'1px solid #e4f15b':'1px solid transparent',borderRadius:10},onClick:()=>{setSelection(Number(row.key));const next=hud?.jobs.find(j=>j.id===Number(row.key));setMaximum(String(next?.level??200))}}
  if(b==='btn_openItem')return {onClick:()=>setExpanded(v=>v.includes(Number(row.key))?v.filter(id=>id!==Number(row.key)):[...v,Number(row.key)])}
  if(b==='ctr_bottom')return {hidden:!expanded.includes(Number(row.key))}
  return row.resolve(b,s)
 }}))}
 return {resolve,repeaters}
}
