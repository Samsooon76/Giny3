import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { GinyClient } from '../../giny/GinyClient'
import { emptyCombat, type CombatState } from '../../giny/combatState'
import type { HudSpell } from '../../giny/types'
import { GameHud } from './GameHud'
import { REFERENCE_HUD } from './referencePreview'
import { MonsterGroupTooltip } from './CombatHud'
import { MapPreview } from '../screens/WorldView'
import { GameRenderer } from '../../game/renderer/GameRenderer'
import { reduceCombat, type CombatEvent } from '../../giny/combatState'

/** Explicitly disconnected visual workshop, gated by App's development preview. */
export function OfficialCombatReview({ phase }: { phase: string }) {
  const spellPhase = ['spells','effects','aoe'].includes(phase)
  const hud={...REFERENCE_HUD,character:{...REFERENCE_HUD.character,level:8},experience:{current:800,floor:0,next:1000}}, id=hud.character.id
  const [selected,select]=useState<HudSpell|null>(null)
  const host=useRef<HTMLDivElement>(null), renderer=useRef<GameRenderer|null>(null)
  const [busy,setBusy]=useState(false)
  const [,setMounted]=useState(false)
  const [state,setState]=useState<CombatState>(()=>{
    const result=phase==='result'
    const extra = phase==='aoe' ? [{id:-2,name:'Bouftor Éthéré II',look:'{3240|||100}',preview_complex:false,preview_stats:[...[107,120,121,122,123,124,125,141,142].map(id=>({id,total:100})),{id:35,total:10}],level:3,team:1,cell:228,direction:3,life:21,max_life:21,ap:6,mp:3,shield:0,alive:true,ready:true,breed:0}] : []
    return {...emptyCombat(), deadline:Date.now()+27000, snapshot:result||phase==='group'?null:{fight_key:'ui-review',fight_id:1,map_id:153880835,phase:phase==='fighting'||phase==='tackle'||spellPhase?'fighting':'preparation',turn:1,active_id:phase==='fighting'||phase==='tackle'||spellPhase?id:0,controlled_id:id,team:0,leader:true,ready:false,remaining_ms:27000,placement:[],enemy_placement:[],timeline:[id,-1,...extra.map(f=>f.id)],cooldowns:[],marks:[],spells:spellPhase?[{id:phase==='effects'?12983:201,name:phase==='effects'?'Retour du bâton':'Sort officiel 201',grade:1,icon_id:10075,ap_cost:4,critical_hit_probability:10,min_range:1,range:phase==='aoe'?6:2,cast_test_los:true,preview_zones:[phase==='aoe'?'C1':'P1'],preview_effects:[{effectId:98,diceNum:13,diceSide:18,rawZone:phase==='aoe'?'C1':'P1',targetMask:'a,A',triggers:'I'}],preview_critical_effects:[{effectId:98,diceNum:19,diceSide:27,rawZone:phase==='aoe'?'C1':'P1',targetMask:'a,A',triggers:'I'}]}]:hud.spells,fighters:[{id,name:hud.character.name,look:hud.character.look,preview_complex:false,preview_stats:[...[107,120,121,122,123,124,125,141,142].map(id=>({id,total:100})),{id:15,total:100}],level:hud.character.level,team:0,cell:227,tackle_evade:4,can_be_tackled:true,can_move:true,direction:1,life:55,max_life:55,ap:6,mp:3,shield:0,alive:true,ready:false,breed:1},{id:-1,name:'Bouftor Éthéré',look:'{3240|||100}',preview_complex:false,preview_stats:[...[107,120,121,122,123,124,125,141,142].map(id=>({id,total:100})),{id:34,total:20}],level:5,team:1,cell:phase==='tackle'||spellPhase?213:214,tackle_block:4,can_tackle:true,direction:3,life:28,max_life:28,ap:6,mp:3,shield:0,alive:true,ready:true,breed:0},...extra]},result:result?{key:'ui-review',duration:12000,turn:1,statistics:{[id]:{damage:28,received:0,heal:0,healed:0,kills:1}},participants:[{id,name:hud.character.name,look:hud.character.look,level:hud.character.level,outcome:2,alive:true,xp:'1',kamas:'4',loot:[{gid:16511,quantity:2},{gid:385,quantity:1}]},{id:-1,name:'Bouftor Éthéré',look:'{3240|||100}',level:5,outcome:0,alive:false,xp:'0',kamas:'0',loot:[]}]}:null}
  })
  const [display,setDisplay]=useState<GameRenderer['combatDisplay']>()
  const selectedRef=useRef(selected)
  selectedRef.current=selected
  const latest=useRef(state)
  const revision=useRef(1), busyRef=useRef(false)
  useLayoutEffect(()=>{latest.current=state;busyRef.current=busy},[state,busy])
  useEffect(()=>{
    if(!host.current || !latest.current.snapshot)return
    const controller=new AbortController()
    const view=new GameRenderer({mapId:153880835,onStats:()=>{},onError:console.error,onCombatCell:(cell,path)=>{
      if(busyRef.current)return
      const s=latest.current
      if(!s.snapshot)return
      if(s.snapshot.phase==='preparation'){setState({...s,snapshot:{...s.snapshot,fighters:s.snapshot.fighters.map(f=>f.id===id?{...f,cell}:f)}});return}
      if(selectedRef.current) {
        const cast = selectedRef.current
        busyRef.current=true; setBusy(true)
        const event:CombatEvent={schemaVersion:1,revision:++revision.current,characterId:String(id),fightKey:s.snapshot.fight_key,name:'GameActionFightSpellCastMessage',
          data:{sourceId:id,targetId:s.snapshot.fighters.find(f=>f.cell===cell)?.id??0,destinationCellId:cell,spellId:cast.id,spellLevel:cast.grade,critical:1,silentCast:false},snapshot:null}
        void view.presentCombat(event,s,controller.signal).catch(console.error).finally(()=>{busyRef.current=false;setBusy(false)})
        return
      }
      if(path.length<2)return
      busyRef.current=true; setBusy(true)
      const event:CombatEvent={schemaVersion:1,revision:++revision.current,characterId:String(id),fightKey:s.snapshot.fight_key,name:'GameMapMovementMessage',data:{actorId:id,path},snapshot:null}
      const next=reduceCombat(s,event)
      void view.presentCombat(event,next,controller.signal).then(()=>{
        const delta:CombatEvent={...event,revision:++revision.current,name:'GameActionFightPointsVariationMessage',data:{sourceId:id,targetId:id,resource:'mp',delta:-(path.length-1),reason:'cost'}}
        const end=reduceCombat(next,delta)
        return view.presentCombat(delta,end,controller.signal).then(()=>setState(end))
      }).finally(()=>setBusy(false))
    }})
    renderer.current=view
    setDisplay(view.combatDisplay)
    void view.mount(host.current).then(async()=>{
      await view.presentCombat(null,latest.current,controller.signal)
      setMounted(true)
      if(phase!=='tackle'||controller.signal.aborted)return
      setBusy(true)
      let current=latest.current
      for(const [name,data] of [
        ['GameActionFightTackledMessage',{sourceId:id,tacklersIds:[-1]}],
        ['GameActionFightPointsVariationMessage',{sourceId:id,targetId:id,resource:'ap',delta:-3,reason:'tackle'}],
        ['GameActionFightPointsVariationMessage',{sourceId:id,targetId:id,resource:'mp',delta:-2,reason:'tackle'}],
      ] as const){
        const event:CombatEvent={schemaVersion:1,revision:++revision.current,characterId:String(id),fightKey:'ui-review',name,data,snapshot:null}
        current=reduceCombat(current,event)
        await view.presentCombat(event,current,controller.signal)
      }
      if(!controller.signal.aborted){setState(current);setBusy(false)}
    }).catch(console.error)
    return()=>{controller.abort();view.destroy();renderer.current=null}
  },[id,phase])
  useEffect(()=>{const controller=new AbortController();void renderer.current?.presentCombat(null,state,controller.signal);return()=>controller.abort()},[state])
  useEffect(()=>renderer.current?.selectCombatSpell(selected),[selected])
  const client=useMemo(()=>{
    const c=new GinyClient()
    c.dismissCombatResult=()=>setState(s=>({...s,result:null}))
    c.combatCommand=(action,value=0)=>setState(s=>{
      if(action==='bonus')return {...s,bonus:value}
      if(action==='challengeMode')return {...s,mode:value}
      if(action==='challenges')return {...s,proposals:[{id:1,name:'Prudent',description:'Ne terminez pas votre tour au contact d’un ennemi.',xp:25,drop:25,state:2},{id:2,name:'Nomade',description:'Utilisez tous vos points de mouvement.',xp:40,drop:40,state:2}]}
      if(action==='challenge')return {...s,challenges:s.proposals.filter(p=>p.id===value),proposals:[]}
      if(action==='ready')return {...s,deadline:Date.now()+30000,snapshot:s.snapshot?{...s.snapshot,phase:'fighting',active_id:id}:null}
      return s
    })
    return c
  },[id])
  return <div className="world-screen">{state.snapshot?<div ref={host} style={{position:'absolute',inset:0}}/>:<MapPreview mapId={153880835}/>}<GameHud hud={hud} liveCombat={{ display,state,client,busy,selected,select,report:console.error}}/>{phase==='group'&&<MonsterGroupTooltip hud={hud} partySize={3} hover={{x:860,y:420,actor:{id:-1,kind:'monster_group',cell_id:214,direction:3,entity_look:'{3240|||100}',group:{attackable:true,modular:false,xp:300,kamas:12,drops:[385,16511,2270,2475,311,1985,287,2465,2469,2473],members:[{id:1,name:'Bouftor Éthéré',level:5,grade:1,look:'{3240|||100}'},{id:2,name:'Feu Follet',level:1,grade:1,look:'{3240|||100}'}]}}}}/>}<small role="status" style={{position:'absolute',top:3,left:180,zIndex:300,color:'white',background:'#1b1d32',pointerEvents:'none'}}>Aperçu UI · Déconnecté du serveur</small></div>
}
