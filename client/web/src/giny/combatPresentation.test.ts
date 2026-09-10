import { expect, it } from 'vitest'
import { GinyClient } from './GinyClient'
import type { CombatEvent } from './combatState'
import type { CombatSnapshot } from './combatState'
const snapshot = {fight_key:'test',fight_id:1,map_id:1,phase:'preparation',turn:1,active_id:101,controlled_id:101,team:0,leader:true,ready:false,remaining_ms:30000,placement:[],enemy_placement:[],timeline:[],cooldowns:[],marks:[],fighters:[]} as CombatSnapshot

it('keeps the HUD behind a pending visual while the authority has advanced',async()=>{
  const client=new GinyClient()
  const internal=client as unknown as {selectedCharacter:{id:number};receiveCombat(e:CombatEvent):void;combatQueue:{drain():Promise<void>}}
  internal.selectedCharacter={id:101}
  let finish!:()=>void
  client.setCombatPresenter(async()=>new Promise<void>(resolve=>{finish=resolve}))
  internal.receiveCombat({schemaVersion:1,characterId:'101',revision:1,fightKey:snapshot.fight_key,name:'GameFightJoinMessage',data:{},snapshot})
  await Promise.resolve()
  expect(client.getAuthoritativeCombatState().snapshot).not.toBeNull()
  expect(client.getCombatState().snapshot).toBeNull()
  finish();await internal.combatQueue.drain()
  expect(client.getCombatState().snapshot).toBe(snapshot)
  expect(client.presentedRevision).toBe(1)
})

it('never prints an unsolicited monster refusal but keeps errors for player-requested casts',async()=>{
  const client=new GinyClient(),lines:string[]=[]
  const internal=client as unknown as {selectedCharacter:{id:number};receiveCombat(e:CombatEvent):void;combatQueue:{drain():Promise<void>};send:()=>void}
  internal.selectedCharacter={id:101};internal.send=()=>{}
  client.onChat(line=>lines.push(line.content))
  const send=(revision:number,name:string,data:Record<string,unknown>,snap:CombatSnapshot|null=null)=>internal.receiveCombat({schemaVersion:1,characterId:'101',revision,fightKey:'test',name,data,snapshot:snap})
  send(1,'GameFightJoinMessage',{}, {...snapshot,phase:'fighting'})
  await internal.combatQueue.drain()
  send(2,'GameActionFightNoSpellCastMessage',{spellLevelId:55})
  await internal.combatQueue.drain();expect(lines).toEqual([])
  client.combatCommand('cast',12983,250)
  send(3,'GameActionFightNoSpellCastMessage',{spellLevelId:55})
  await internal.combatQueue.drain();expect(lines).toHaveLength(1);expect(lines[0]).toContain('Sort refusé')
  send(4,'GameActionFightNoSpellCastMessage',{spellLevelId:55})
  await internal.combatQueue.drain();expect(lines).toHaveLength(1)
})
