import { describe, expect, it } from 'vitest'
import { companionStat } from './companions'
import { calendarWeek } from './calendar'
import { activateModuleOption, DEFAULT_MODULE_OPTIONS, moduleOptions, sanitizeModuleOptions } from '../official/moduleOptions'
import { applyClonedStatsLayout } from '../official/uitk'

describe('reference presentation data',()=>{
 it('applies companion base values and each level range once',()=>{
  const ranges=[{values:[1,6]},{values:[200,.0302]}]
  expect(companionStat(ranges,1)).toBe(6)
  expect(companionStat(ranges,200)).toBe(12)
  expect(companionStat(ranges,250)).toBe(12)
  expect(companionStat([{values:[10,2]},{values:[20,3]}],15)).toBe(33)
 })
 it('keeps Monday-first weeks across years without mutating the selected day',()=>{
  const selected=new Date(2027,0,1)
  const days=calendarWeek(selected,0)
  expect(days.map(d=>[d.getMonth(),d.getDate()])).toEqual([[11,28],[11,29],[11,30],[11,31],[0,1],[0,2],[0,3]])
  expect(selected.getDate()).toBe(1)
  expect(calendarWeek(selected,-1)[0].getDate()).toBe(21)
 })
 it('rejects damaged persisted geometry and invalid colors',()=>{
  expect(sanitizeModuleOptions({rows:Infinity,chatFont:200,gaugeColor:'url(evil)'})).toEqual(DEFAULT_MODULE_OPTIONS)
  expect(sanitizeModuleOptions({rows:3,gaugeColor:'#123abc',hp:'percent'})).toMatchObject({rows:3,gaugeColor:'#123abc',hp:'percent'})
 })
 it('keeps module preferences independent and toggles checkbox options',()=>{
  activateModuleOption('test-character',{label:'Invocations',key:'showInitiative',value:true})
  expect(moduleOptions.get('TEST-CHARACTER').showInitiative).toBe(true)
  expect(moduleOptions.get('other').showInitiative).toBe(false)
  activateModuleOption('test-character',{label:'Invocations',key:'showInitiative',value:true})
  expect(moduleOptions.get('test-character').showInitiative).toBe(false)
 })
 it('preserves explicit widths when sharing stat row templates',()=>{
  const style={width:'calc(50% - 6px)',flexShrink:0}
  applyClonedStatsLayout('statTwoColumnsItem',{binding:'ctr_stat'},style)
  expect(style).toEqual({width:'calc(50% - 6px)',flexShrink:0})
 })
})
