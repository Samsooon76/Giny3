import { useState } from 'react'
import type { CharacterHud } from '../../giny/types'
import type { BindingResolver } from '../official/types'
import type { Repeater } from '../official/repeaters'
import { itemIcon } from './catalog'
/** Presentation contract. A future fight protocol adapter can supply this
 * snapshot without changing the extracted windows or executing combat here. */
export type FightPresentation={turn:number;seconds:number;duration:number;victory:boolean;damage:number;kamas:number;xp:number;loot:number[];enemyLook:string}
export const REFERENCE_FIGHT:FightPresentation={turn:1,seconds:27,duration:12,victory:true,damage:28,kamas:4,xp:1,loot:[16511,385],enemyLook:'{3240|||100}'}
export function useCombatPresentation(hud:CharacterHud|null,snapshot?:FightPresentation){
 const [tab,setTab]=useState(0),[toggles,setToggles]=useState<string[]>([])
 const resolve:BindingResolver=b=>{
  if(b==='fightTimelineMagneticDragWindow')return {style:{flexDirection:'row'}}
  if(b==='header_titleLabel')return {text:snapshot?'Combat terminé':'Aucun résultat de combat'}
  if(b==='tab_content')return {hidden:!snapshot}
  if(b==='lbl_currentTurn'||b==='lbl_turn')return {text:String(snapshot?.turn??0)}
  if(b==='lbl_seconds')return {style:{fontSize:38,color:'#a5e442',fontWeight:700,textAlign:'center',justifyContent:'center',width:'100%'},text:`${snapshot?.seconds??0}s`}
  if(b==='lbl_turnCount')return {text:'0'}
  if(b==='ctr_animation'||b==='ctr_waves'||b==='ctr_limiter'||b==='ctr_arena'||b==='ctr_currentOmega'||b==='ctr_nextOmega')return {hidden:true}
    if(b==='btn_EndTurn')return {tooltip:{tree:'TextTooltip',text:'Aperçu de préparation : aucun combat n’est lancé.'}}
  if(b==='coloredTimerGauge')return {style:{width:`${(snapshot?.seconds??0)/30*100}%`}}
  if(b.startsWith('tg_'))return {checked:toggles.includes(b),onClick:()=>setToggles(v=>v.includes(b)?v.filter(k=>k!==b):[...v,b])}
  if(b==='ctr_EndTurn')return {style:{width:'calc(100% - 20px)',height:90,marginTop:12}}
  if(b==='tg_lockParty')return {hidden:true}
  if(b==='btn_leave')return {style:{background:'#733b43'}}
  if(b==='ctr_timeGauge')return {hidden:false,style:{bottom:0,background:'#121426'}}
  if(b==='buttonBackground')return {style:{background:'radial-gradient(ellipse,#a4bc32 20%,#719310 65%,#344607)',width:'100%',height:'100%',border:'4px solid #17192c',boxShadow:'inset 0 0 8px #000',borderRadius:24}}
  if(b==='ctr_counter')return {style:{position:'absolute',width:128,height:56,top:-26,left:'calc(50% - 64px)',background:'linear-gradient(#484f6b,#181e30)',borderRadius:'42px 42px 0 0',zIndex:2}}
  if(b==='lbl_endTurn')return {text:'CHOISIR LES CHALLENGES',style:{fontSize:24,lineHeight:'28px',whiteSpace:'normal',textAlign:'center',width:'100%'}}
  if(b==='ctr_timelineContent')return {style:{flexDirection:'row',height:'100%',alignItems:'center'}}
  if(b==='ctr_counters')return {style:{width:30,height:'100%',flexShrink:0}}
  if(b==='sv_fighters')return {style:{display:'flex',flexDirection:'row',gap:8,height:110,minHeight:110,flexShrink:0,marginBottom:0}}
  if(b==='lbl_time')return {text:`00:${String(snapshot?.duration??0).padStart(2,'0')}`}
  if(b==='lbl_percent')return {text:'0%'}
  if(b==='lbl_result')return {text:snapshot?.victory?'VICTOIRE':'DÉFAITE'}
  if(b==='lbl_scoreTitle'||b==='lbl_scoreValue'||b==='carrousel_challenge')return {hidden:true}
  if(b==='entityDisplayer')return {look:hud?.character.look,lookMode:'fit'}
  if(b==='lbl_charName')return {text:hud?.character.name}
  if(b==='lbl_dmgDoneValue')return {text:String(snapshot?.damage??0)}
  if(/^lbl_(dmgTaken|dmgBlocked|shieldApplied|healDone|healReceived)Value$/.test(b))return {text:'0'}
  if(b==='lbl_enemiesFinishedValue')return {text:'1'}
  if(b==='lbl_kamasValue')return {text:String(snapshot?.kamas??0)}
  if(b==='lbl_xp')return {text:`+ ${snapshot?.xp??0}`}
  if(b==='lbl_currentLevel')return {text:String(hud?.character.level??1)}
  if(b==='lbl_nextLevel')return {text:String(Math.min(200,(hud?.character.level??1)+1))}
  if(b==='gaugeXp')return {value:85}
  if(b==='lbl_noLoot')return {hidden:!!snapshot?.loot.length}
  if(b==='ctr_lootValue')return {hidden:true}
  if(b==='gd_items')return {style:{height:64,alignContent:'flex-start'}}
  if(b==='tab_myCharacter'||b==='tab_resume'||b==='tab_statistics'){const index=['tab_myCharacter','tab_resume','tab_statistics'].indexOf(b);return {className:tab===index?'activeTrue':'activeFalse',disabled:index!==0,onClick:()=>setTab(index)}}
  return undefined
 }
 const resultRepeaters:Repeater={tab_content:snapshot?[{key:String(tab),template:['fightResultCharacterTab','fightResultResumeTab','fightResultStatsTab'][tab],resolve,repeaters:{gd_items:snapshot.loot.map(gid=>({key:String(gid),template:'EncyclopediaLootSlot',resolve:b=>b==='loot_slot'?{sprite:itemIcon({gid})}:undefined})),list_enemies:[{key:'enemy',template:'fightResultMonsterLine',resolve:b=>b==='tile'?{look:snapshot.enemyLook,lookMode:'fit',lookStatic:true}:b==='lbl_name'?{text:'Bouftor Éthéré'}:b==='lbl_lvl'?{text:'Niv. 5'}:undefined}]}}]:[]}
 const timelineRepeaters:Repeater={sv_fighters:snapshot?[hud?.character.look,snapshot.enemyLook].map((look,i)=>({key:String(i),template:'timelineFighter',resolve:b=>b==='timelineFighter'?{style:{width:100,height:110,borderImageSource:'none',border:'2px solid #23233b'}}:b==='ctr_ed'?{hidden:false,style:{width:'100%',height:'100%'}}:b==='ed_player'?{hidden:false,style:{width:'100%',height:'100%',position:'absolute',inset:0},look,lookMode:i===0?'portrait':'fit',lookStatic:true}:b==='gauge_life'?{hidden:false,value:100,style:{position:'absolute',left:0,top:0,width:7,height:'100%',background:'#df4265'}}:b==='ctr_fighterTile'?{style:{background:i===0?'#345974':'#704751'}}:['tx_monster','gauge_shield','gauge_threshold','lbl_order','lbl_monsterWave','ic_invocation','mask_time','ctr_additionalTurn'].includes(b)?{hidden:true}:undefined})):[]}
 return {resolve,repeaters:resultRepeaters,timelineRepeaters}
}
