import { afterEach, expect, it, vi } from 'vitest'
import { PendingSpellCasts } from './pendingSpellCasts'
import type { CombatEvent, CombatSnapshot } from './combatState'
const state={phase:'fighting',fight_key:'a',turn:2,active_id:101,controlled_id:101} as CombatSnapshot
const event=(name='GameActionFightNoSpellCastMessage',data:Record<string,unknown>={spellLevelId:55}):CombatEvent=>({schemaVersion:1,revision:1,characterId:'101',fightKey:'a',name,data,snapshot:null})
afterEach(()=>vi.useRealTimers())
it('ignores repeated AI refusals without a local cast request, including during our turn',()=>{
  const pending=new PendingSpellCasts()
  for(let i=0;i<20;i++) expect(pending.receive(event(),state)).toBe(false)
})
it('reports a matching refused spell once and ignores other spell levels',()=>{
  const pending=new PendingSpellCasts();pending.add(state,12,55)
  expect(pending.receive(event(undefined,{spellLevelId:99}),state)).toBe(false)
  expect(pending.receive(event(),state)).toBe(true)
  expect(pending.receive(event(),state)).toBe(false)
})
it('clears a successful cast before later unsolicited failures',()=>{
  const pending=new PendingSpellCasts();pending.add(state,12,55)
  expect(pending.receive(event('GameActionFightSpellCastMessage',{sourceId:101,spellId:12}),state)).toBe(false)
  expect(pending.receive(event(),state)).toBe(false)
})
it('does not confuse another caster with our request, including when controlling a summon',()=>{
  const pending=new PendingSpellCasts(),summon={...state,active_id:-3,controlled_id:-3}
  pending.add(summon,12,55)
  expect(pending.receive(event('GameActionFightSpellCastMessage',{sourceId:-4,spellId:12}),summon)).toBe(false)
  expect(pending.receive(event(undefined,{sourceId:-4,spellLevelId:55}),summon)).toBe(false)
  expect(pending.receive(event(),summon)).toBe(true)
})
it('forgets pending requests at turn end, combat changes, disconnection and expiry',()=>{
  for(const next of [{...state,active_id:-4},{...state,turn:3},{...state,fight_key:'b'},null]) {
    const pending=new PendingSpellCasts();pending.add(state,12,55)
    pending.receive(event('GameFightSynchronizeMessage',{}),next)
    expect(pending.receive(event(),state)).toBe(false)
  }
  vi.useFakeTimers();const pending=new PendingSpellCasts();pending.add(state,12,55)
  vi.advanceTimersByTime(10000)
  expect(pending.receive(event(),state)).toBe(false)
  pending.add(state,12,55);pending.clear();expect(pending.receive(event(),state)).toBe(false)
})
it('does not retain a request when sending failed, and handles weapon level zero',()=>{
  const pending=new PendingSpellCasts();const cancel=pending.add(state,12,55);cancel()
  expect(pending.receive(event(),state)).toBe(false)
  pending.add(state,0,0)
  expect(pending.receive(event(undefined,{spellLevelId:0}),state)).toBe(true)
})
