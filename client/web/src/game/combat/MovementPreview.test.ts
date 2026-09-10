import { expect, it } from 'vitest'
import { CellGrid, cellIdToWorld } from '../cells/CellGrid'
import type { WebMapData } from '../maps/types'
import type { CombatFighter, CombatSnapshot } from '../../giny/combatState'
import { movementPreview, roundLoss } from './MovementPreview'
const grid = new CellGrid({ id: 1, cells: Array.from({length:560}, (_,cellId)=>{const p=cellIdToWorld(cellId);return {cellId,x:p.x,y:-p.y,mov:1,los:1,nonWalkableDuringFight:0}}) } as WebMapData)
const me = {id:1,team:0,cell:227,ap:6,mp:3,alive:true,tackle_evade:4,can_be_tackled:true,can_move:true} as CombatFighter
const foe = {id:2,team:1,cell:213,alive:true,tackle_block:4,can_tackle:true} as CombatFighter
const snapshot = (fighters: CombatFighter[])=>({controlled_id:1,fighters} as CombatSnapshot)
it('previews Giny tackle without mutating AP/MP, and draws the beyond-budget tail',()=>{
  const state=snapshot([me,foe]), before=JSON.stringify(state)
  const p=movementPreview(grid,state,256)
  expect(p.apLost).toBe(3);expect(p.mpLost).toBe(2)
  expect(p.path.length).toBeLessThanOrEqual(2)
  expect(p.unreachablePath.length).toBeGreaterThan(0)
  expect(JSON.stringify(state)).toBe(before)
})
it('total tackle cannot produce a playable step',()=>{
  const p=movementPreview(grid,snapshot([me,{...foe,tackle_block:1000}]),241)
  expect(p.mpLost).toBe(3);expect(p.reachable).toEqual([]);expect(p.path).toEqual([227])
})
it('unknown lock remains unknown and non-tackling enemies cost nothing',()=>{
  expect(movementPreview(grid,snapshot([me,{...foe,tackle_block:undefined}]),241).uncertain).toBe(true)
  expect(movementPreview(grid,snapshot([me,{...foe,can_tackle:false}]),241).mpLost).toBe(0)
})
it('matches C# midpoint rounding for resource loss',()=>{expect([.5,1.5,2.5,3.5].map(roundLoss)).toEqual([0,2,2,4])})
