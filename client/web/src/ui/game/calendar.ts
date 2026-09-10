import { useState } from 'react'
import type { BindingResolver } from '../official/types'
import type { Repeater } from '../official/repeaters'
import { useReferenceCatalog } from './referenceCatalog'
import { itemIcon } from './catalog'
const FILTERS=[['Festivités','#44bfdf','calendar'],['Almanax','#de63ee','calendar'],['Événements Krosmiques','#f8d438','styles/images/icon_spiral.png'],['Kolizéum','#ff7a48','brokenSwords']]
export function calendarWeek(date:Date,offset:number){const start=new Date(date.getFullYear(),date.getMonth(),date.getDate());start.setDate(start.getDate()-((start.getDay()+6)%7)+offset*7);return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return d})}
export function useCalendar(active:boolean){
 const data=useReferenceCatalog(active),[offset,setOffset]=useState(0),[hidden,setHidden]=useState<number[]>([]),[selectedDay,setSelectedDay]=useState(5),[minimum,setMinimum]=useState('1'),[maximum,setMaximum]=useState('200')
 const preview=new URLSearchParams(location.search).has('ui-preview'),today=preview?new Date(2026,8,5):new Date(),days=calendarWeek(today,offset)
 const fixtureNames=['Dantinéa','Sphincter Cell','Founoroshi','Bouftou Royal','Skeunk']
 const rows=preview&&offset===0?(data.calendarevents??[]).filter(r=>fixtureNames.includes(r.name??'')&&!hidden.includes(0)&&(r.recommendedLevel??1)>=Number(minimum)&&(r.recommendedLevel??200)<=Number(maximum)).sort((a,b)=>fixtureNames.indexOf(a.name??'')-fixtureNames.indexOf(b.name??'')):[]
 const resolve:BindingResolver=b=>{
  if(b==='header_titleLabel')return {text:'Calendrier'}
  if(b==='lbl_date')return {style:{width:'100%',whiteSpace:'nowrap',maxWidth:'none'},text:days[0].toLocaleDateString('fr',{month:'long',year:'numeric'})+(days[0].getMonth()!==days[6].getMonth()?` – ${days[6].toLocaleDateString('fr',{month:'long',year:'numeric'})}`:'')}
  if(b==='lbl_dofusDate')return {text:`${days[6].toLocaleDateString('fr',{month:'long'})} ${days[6].getFullYear()-1370}`}
  if(b==='btn_prev')return {onClick:()=>setOffset(offset-1)}
  if(b==='btn_next')return {onClick:()=>setOffset(offset+1)}
  if(b.startsWith('btn_backToday'))return {hidden:offset===0,onClick:()=>setOffset(0)}
  if(b==='lbl_calendarFilterTitle')return {text:'MES CALENDRIERS'}
  if(b==='ctr_days')return {style:{flexDirection:'row',gap:8}}
  if(b==='gd_events')return {style:{overflowY:'auto',flex:1,padding:'0 20px 20px 90px'}}
  if(b==='ctr_specialDay')return {hidden:true}
  if(b==='lbl_dayBonusTitle')return {text:'Bonus du jour'}
  if(b==='lbl_dayBonus')return {text:'Aucun bonus disponible.',style:{whiteSpace:'normal'}}
  if(b==='tx_zodiac')return {sprite:preview?'/game-data/client/illustrations/calendar/10.png':undefined,style:{width:80,height:80,flexShrink:0},hidden:!preview}
  if(b==='tx_protector')return {sprite:preview?'/game-data/client/illustrations/calendar/9.png':undefined,style:{width:80,height:80,flexShrink:0},hidden:!preview}
  if(b==='lbl_zodiac')return {text:preview?'LA WARKETTE':'—'}
  if(b==='lbl_protector')return {text:preview?'RAVAL':'—'}
  return undefined
 }
 const repeaters:Repeater={
  levelFilter:[{key:'level',template:'GenericFilterCategory',resolve:b=>b==='filter_title'?{text:'NIVEAU'}:b==='filter_toggle'?{text:'−'}:b==='filter_hint'?{hidden:true}:undefined,repeaters:{filter_options:[{key:'range',template:'MinMaxFilterCategory',resolve:b=>b==='Min'?{text:minimum,onInput:e=>setMinimum(e.target.value)}:b==='Max'?{text:maximum,onInput:e=>setMaximum(e.target.value)}:b==='btn_help'?{hidden:true}:undefined}]}}],
  gd_calendarFilters:FILTERS.map(([label,color,icon],i)=>({key:String(i),template:'calendarFilterItem',resolve:b=>b==='checkboxLine_labelRight'?{text:label}:b==='tx_drag'?{sprite:icon}:b==='colorSquare'?{hidden:false,style:{background:color,width:28,height:28,marginLeft:'auto'}}:b==='chbx_filterName'?{checked:!hidden.includes(i),onClick:()=>setHidden(v=>v.includes(i)?v.filter(n=>n!==i):[...v,i])}:undefined})),
  ctr_days:days.map((d,i)=>({key:d.toISOString(),template:'calendarDayCard',resolve:b=>b==='lbl_dayName'?{text:d.toLocaleDateString('fr',{weekday:'long'})}:b==='lbl_dayNumber'?{text:String(d.getDate())}:b==='ctr_calendarDayCard'?{onClick:()=>setSelectedDay(i),style:{width:'calc(14.285% - 7px)',background:i===selectedDay?'#44456d':'#2b2d4b'}}:undefined})),
  gd_events:rows.map((r,i)=>({key:String(r.id),template:'calendarCard',resolve:b=>b==='ctr_calendarCard'?{style:{height:140,minHeight:140,flexShrink:0,marginBottom:6,background:'#255874',border:'1px solid #647b99',borderRadius:8}}:b==='ctr_content'?{style:{padding:10,alignItems:'stretch'}}:b==='ctr_mainInfo'?{style:{alignItems:'stretch',flex:1}}:b==='ctr_duration'?{style:{flexDirection:'row',justifyContent:'space-between',width:'100%'}}:b==='ctr_itemsList'?{style:{flexDirection:'row',justifyContent:'flex-start',alignItems:'flex-start',height:38}}:b==='ctr_rewards'?{style:{justifyContent:'flex-start',height:40}}:b==='lbl_title'?{text:r.name,style:{flex:1,alignItems:'center',justifyContent:'flex-start',textAlign:'left'}}:b==='lbl_start'?{text:`Début : ${new Date(2026,7,[18,11,4,-10,-3][i]).toLocaleDateString('fr')}`}:b==='lbl_end'?{text:'Fin : 08/09/2026'}:['tx_offering','offeringDivider','ctr_buttons','tx_icon','btn_left','btn_right'].includes(b)?{hidden:true}:undefined,repeaters:{ctr_itemsList:(r.rewards??'').split(',').filter(Boolean).map(gid=>({key:gid,template:'EncyclopediaLootSlot',resolve:b=>b==='loot_slot'?{sprite:itemIcon({gid:Number(gid)}),style:{width:36,height:36,flex:'0 0 36px'}}:undefined}))}})),
 };return {resolve,repeaters}
}
