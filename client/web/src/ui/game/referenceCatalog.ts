import { useEffect, useState } from 'react'
export type ReferenceRow = {id:number;objectiveIds?:number[];achievementId?:number;startingSpellLevelId?:number;companionId?:number;caracId?:number;statPerLevelRange?:Array<{values:number[]}>;nameId?:number;descriptionId?:number;name?:string;description?:string;assetId?:number;look?:string;spells?:number[];spellId?:number;gfxId?:string;minLevel?:number;maxLevel?:number;order?:number;isPrimordial?:number;isEvent?:number;categoryId?:number;recommendedLevel?:number;rewards?:string;picture?:string;iconId?:number;points?:number;prerequisites?:Array<{value:number;type:number}>;steps?:Array<{value:number;type:number}>}
export type ReferenceCatalog = Record<string,ReferenceRow[]>
const TABLES=['companions','companioncharacteristics','companionspells','dofusprogressions','calendarevents','achievements','achievementobjectives']
let promise:Promise<ReferenceCatalog>|undefined
export function loadReferenceCatalog(){
  return promise??=Promise.all([fetch('/game-data/client/i18n.json').then(r=>r.json()) as Promise<{by_id:Record<string,string>}>,...TABLES.map(name=>fetch(`/game-data/data/${name}.json`).then(r=>r.ok?r.json():{}))]).then(([language,...tables])=>{
    const by=(language as {by_id:Record<string,string>}).by_id??{}
    return Object.fromEntries(TABLES.map((name,i)=>[name,Object.values(tables[i] as Record<string,ReferenceRow>).map(row=>({...row,name:row.name??by[String(row.nameId)]??'',description:row.description??by[String(row.descriptionId)]??''}))]))
  }).catch(error=>{promise=undefined;throw error})
}
export function useReferenceCatalog(active:boolean){const [data,setData]=useState<ReferenceCatalog>({});useEffect(()=>{if(active)void loadReferenceCatalog().then(setData).catch(console.warn)},[active]);return data}
