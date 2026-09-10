import { useState } from 'react'
import type { CharacterHud } from '../../giny/types'
import type { BindingResolver } from '../official/types'
import type { Repeater } from '../official/repeaters'
import { creationHeadSprite } from './creationBindings'
export function useGuild(hud:CharacterHud|null) {
  const [search,setSearch]=useState('')
  const [offline,setOffline]=useState(false)
  const guild=hud?.guild
  const roster=guild?.members??[]
  const members=roster.filter(m=>(offline||m.online)&&m.name.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')))
  const resolve:BindingResolver=b=>{
    if(b==='ti_search'||b==='inp_search')return {text:search,placeholder:'Rechercher un membre',onInput:e=>setSearch(e.target.value)}
    if(b==='chbx_membersOffline')return {checked:offline,onClick:()=>setOffline(!offline)}
    if(b==='lbl_membersCount')return {hidden:false,text:`Membres : ${members.length} / ${roster.length}`}
    if(b==='lbl_averageMembersLevel')return {hidden:false,text:`Niveau moyen des membres : ${roster.length?Math.round(roster.reduce((sum,m)=>sum+m.level,0)/roster.length):0}`}
    if(b==='btn_manageRanks')return {text:'VOIR LES RANGS'}
    if(b==='btn_fights')return {hidden:true}
    if(b==='lbl_guildName'&&!guild)return {text:'Aucune guilde'}
    return undefined
  }
  const repeaters:Repeater={lv_socialMembers:members.map(m=>({key:String(m.id),template:'guildMemberItem',resolve:b=>{
    if(b==='lbl_memberName')return {text:m.name,style:{color:'#e4f263'}}
    if(b==='tx_memberOmegaLevel')return {style:{backgroundImage:'none',background:'transparent'}}
    if(b==='lbl_memberLevel')return {text:String(m.level)}
    if(b==='lbl_memberRank')return {text:m.rank}
    if(b==='lbl_memberNote')return {text:m.note??''}
    if(b==='lbl_memberGuildatons')return {text:m.guildatons==null?'—':String(m.guildatons)}
    if(b==='lbl_memberAchievments')return {text:String(m.achievement_points??0)}
    if(b==='tx_memberClass')return {sprite:creationHeadSprite(m.breed_id,'male')}
    if(b==='tx_memberStatus')return {style:{background:m.online?'#9bda53':'#666',borderRadius:'50%',width:9,height:9}}
    if(b==='ctr_socialMemberLine')return {style:{background:'#2c2d4b',borderRadius:8,margin:'0 24px',width:'calc(100% - 48px)',height:52}}
    if(['btn_spectateFight','btn_havenbag','ctr_buttons'].includes(b))return {hidden:true}
    return undefined
  }}))}
  return {resolve,repeaters}
}
