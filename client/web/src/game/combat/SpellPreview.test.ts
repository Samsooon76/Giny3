import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'
import { CellGrid, cellIdToWorld } from '../cells/CellGrid'
import type { WebMapData } from '../maps/types'
import type { CombatSnapshot } from '../../giny/combatState'
import { spellPreview } from './SpellPreview'
import { damageInput } from './SpellDamagePreview'
import { parseZone, zoneCells, cellPoint, pointCell } from './bubbleSpellGeometry'
const grid = new CellGrid({id:1,cells:Array.from({length:560},(_,cellId)=>{const p=cellIdToWorld(cellId);return {cellId,x:p.x,y:-p.y,mov:1,los:1,visible:1,nonWalkableDuringFight:0}})} as WebMapData)
const multipliers=[107,120,121,122,123,124,125,141,142].map(id=>({id,total:100}))
const state = {controlled_id:1,turn:1,marks:[],fighters:[{id:1,cell:227,level:8,breed:1,team:0,alive:true,life:55,max_life:55,preview_stats:[...multipliers,{id:10,total:100}],preview_complex:false},{id:2,cell:214,level:5,breed:0,team:1,alive:true,life:50,max_life:50,preview_stats:[...multipliers,{id:33,total:20}],preview_complex:false}]} as unknown as CombatSnapshot
it('ports circle, cross, ring and empty zones without edge wrapping',()=>{
  expect(zoneCells(parseZone('C2'),227,227)).toHaveLength(13)
  expect(zoneCells(parseZone('X1'),227,227)).toHaveLength(5)
  expect(zoneCells(parseZone('O2'),227,227)).toHaveLength(8)
  expect(zoneCells(parseZone(' '),227,227)).toEqual([])
  expect(zoneCells(parseZone('C2'),0,0).every(c=>c>=0&&c<560)).toBe(true)
})
it('keeps spell range independent of terrain elevation and draws its impact zone',()=>{
  const spell={id:1,name:'Test',grade:1,min_range:1,range:5,preview_zones:['C1']}
  const before=spellPreview(grid,state,spell,214)
  grid.worldPositions[214].y-=400
  expect(spellPreview(grid,state,spell,214)).toEqual(before)
  expect(before.area).toHaveLength(5)
})
it('blocks line of sight behind fighters and never highlights an invalid target area',()=>{
  const p=cellPoint(227), near=pointCell(p.x+1,p.y)!, far=pointCell(p.x+2,p.y)!
  const s={...state,fighters:[state.fighters[0],{...state.fighters[1],cell:near}]}
  const result=spellPreview(grid,s,{id:1,name:'Test',grade:1,range:4,cast_test_los:true,preview_zones:['C2']},far)
  expect(result.blocked).toContain(far);expect(result.allowed).toContain(near);expect(result.area).toEqual([])
})
it('supports diagonal-only casting separately from in-line casting',()=>{
  const p=cellPoint(227), diagonal=pointCell(p.x+1,p.y+1)!, line=pointCell(p.x+1,p.y)!
  const result=spellPreview(grid,state,{id:1,name:'Test',grade:1,range:3,min_range:1,cast_in_diagonal:true},diagonal)
  expect(result.allowed).toContain(diagonal);expect(result.allowed).not.toContain(line)
})
const spell={id:1,name:'Test',grade:1,range:5,preview_effects:[{effectId:97,diceNum:10,diceSide:20,rawZone:'P',targetMask:'a,A'}]}
it('runs the unmodified Bubble worker with Giny stats and elemental resistance',()=>{
  const input=damageInput(grid,state,spell,214)
  let output:any
  const self={onmessage:null as any,postMessage:(value:unknown)=>output=value}
  runInNewContext(readFileSync(new URL('../../../public/combat-assets/damage-preview-worker.js',import.meta.url),'utf8'),{self,console})
  self.onmessage({data:{id:1,type:'compute',...input}})
  expect(output.ok,output.message).toBe(true)
  expect(output.raw.affected.length,JSON.stringify(output.raw)).toBeGreaterThan(0)
  const damage=output.raw.affected.find((f:any)=>f.id===2).effects.find((e:any)=>e.damageRange).damageRange
  expect(damage.min).toBe(16);expect(damage.max).toBe(32)
})
it('refuses to invent missing stats or triggered state',()=>{
  expect(damageInput(grid,{...state,fighters:[{...state.fighters[0],preview_stats:undefined}]},spell,214)).toBeNull()
  expect(damageInput(grid,{...state,fighters:[{...state.fighters[0],preview_complex:true}]},spell,214)).toBeNull()
})
