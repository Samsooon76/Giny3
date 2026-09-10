import { useState, useSyncExternalStore } from 'react'
import { OfficialTree } from '../official/OfficialScreen'
import { worldmapHintsFor, worldmap } from './catalog'
import { mapCellCenter, worldmapHintIcon } from './worldmap'
import { worldmapViewStore } from './worldmapStore'

export function MapSearch() {
  const [query,setQuery]=useState('')
  const [filtered,setFiltered]=useState(false)
  const state=useSyncExternalStore(worldmapViewStore.subscribe,worldmapViewStore.snapshot)
  const rows=worldmapHintsFor(state.worldmapId).filter(h=>(!filtered||state.filters.has(h.categoryId))&&(h.name??'').toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))).slice(0,20)
  return <OfficialTree tree="CartographySearchUI" keepPaint rootStyle={{position:'absolute',inset:0,pointerEvents:'none'}} resolve={b=>{
    if(b==='cartographySearch')return {style:{position:'absolute',alignSelf:'flex-start',marginLeft:0,marginRight:0,right:'auto',left:'calc(50% - 202px)',pointerEvents:'auto',zIndex:10}}
    if(b==='inp_search')return {text:query,placeholder:'Rechercher',onInput:e=>setQuery(e.target.value)}
    if(b==='ctr_noSearchResult')return {hidden:!query||rows.length>0}
    if(b==='ctr_searchResult')return {hidden:!query||!rows.length}
    if(b==='lbl_searchResultsCount')return {text:`${rows.length} résultat(s)`}
    if(b==='btn_searchFilter')return {checked:filtered,onClick:()=>setFiltered(!filtered),tooltip:{tree:'TextTooltip',text:'Limiter aux catégories affichées'}}
    if(b==='tx_filterOn')return {hidden:!filtered}
    return undefined
  }} repeaters={{gd_searchResults:rows.map(row=>({key:String(row.id),template:'CartographySearchResultItem',resolve:b=>{
    if(b==='cartographySearchResultItem')return {onClick:()=>{const meta=worldmap(state.worldmapId);if(meta)worldmapViewStore.centerOn(mapCellCenter(meta,row.x,row.y));setQuery('')}}
    if(b==='lbl_resultName')return {text:`${row.name} [${row.x}, ${row.y}]`}
    if(b==='tx_category')return {sprite:worldmapHintIcon(row.gfx)}
    if(b==='tx_resultInOtherMap')return {hidden:true}
    return undefined
  }}))}} />
}
