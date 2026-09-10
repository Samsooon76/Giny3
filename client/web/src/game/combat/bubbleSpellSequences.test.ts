import { expect, it } from 'vitest'
import { nativeSpellPlan, legacySpellPlan, missileDuration, missileRotation, trailLineCells } from './bubbleSpellSequences'

function plan(sequences: unknown[]) {
  return nativeSpellPlan({ scriptId: 16440, spellId: 12983, sourceCellId: 227, targetCellId: 213,
    scriptData: { rawParams: JSON.stringify({ main: { sequences } }) } })
}
it('keeps the official Retour du bâton cast, SHOT boundary and oriented impact', () => {
  expect(plan([{ gfxs: [{ type: 'cast', casterAnimation: 'AnimAttaque110' }] },
    { gfxs: [{ type: 'target', gfxId: 8224, directionType: 'oriented', isOriented: false }] }])).toEqual([
    { kind: 'set-direction', targetId: 0, cellId: 213 },
    { kind: 'parallel', endPolicy: 'wait-for-all', steps: [{ kind: 'native-caster-animation', sourceId: 0,
      animationName: 'AnimAttaque110', riderAnimationName: 'AnimAttaque0', endPolicy: 'shot' }] },
    { kind: 'parallel', endPolicy: 'wait-for-all', steps: [{ kind: 'native-gfx-entity', sourceId: 0,
      gfxId: 8224, cellId: 213, fromCellId: 227, toCellId: 213, yOffsetRatio: 0, displayMode: 2,
      showUnder: false, scaleX: 1, scaleY: 1, frameOffset: 0 }] },
  ])
})
it('preserves simultaneous effects and non-blocking cast policies', () => {
  const p=plan([{ endPolicy:'dontWait', gfxs:[{type:'cast',isCasterOriented:false},{type:'caster',gfxId:8214,strata:'background'}] }])
  expect(p[0]).toMatchObject({kind:'parallel',endPolicy:'dont-wait',steps:[
    {kind:'native-caster-animation',endPolicy:'beginning'}, {kind:'native-gfx-entity',cellId:227,showUnder:true},
  ]})
})
it('rejects unsupported authored fields instead of silently changing the animation', () => {
  expect(()=>plan([{gfxs:[{type:'target',gfxId:8224,unknownScale:4}]}])).toThrow('champ étranger')
})
it('uses Bubble projectile speed units and the curve tangent', () => {
  expect(missileDuration({x:0,y:0},{x:300,y:400},100)).toBe(500)
  expect(missileDuration({x:0,y:0},{x:300,y:400},200)).toBe(1000)
  expect(missileRotation({x:0,y:0},{x:100,y:0},0,0.5)).toBe(0)
  expect(missileRotation({x:0,y:0},{x:100,y:0},0.5,0)).toBeLessThan(0)
  expect(missileRotation({x:0,y:0},{x:100,y:0},0.5,1)).toBeGreaterThan(0)
})
it('places trails on their authored cells, with independently controlled endpoints', () => {
  const p=plan([{gfxs:[{type:'trail',gfxId:1,isFromCaster:true,isToTarget:true}]}])
  expect(p[0]).toMatchObject({kind:'parallel',steps:[{kind:'trail',cellIds:[227,...trailLineCells(227,213)]}]})
  expect(trailLineCells(227,227)).toEqual([])
})

it('keeps Bubble legacy projectile order, speed and secondary impact', () => {
  const context={scriptId:1,spellId:201,sourceCellId:227,targetCellId:213}
  const missile=legacySpellPlan({...context,scriptData:{type:2,rawParams:'animId:0,casterGfxId:10,missileGfxId:20,missileSpeed:2,targetGfxId:30'}})
  expect(missile.map(s=>s.kind)).toEqual(['set-direction','caster-animation','gfx-entity','missile','gfx-entity'])
  expect(missile[3]).toMatchObject({gfxId:20,speed:120,curvature:.5})
  const impacts=legacySpellPlan({...context,scriptData:{type:1,rawParams:'animId:0,targetGfxId:30,targetGfxId2:31,targetGfxShowUnder2:1'}})
  expect(impacts.slice(-2)).toMatchObject([{gfxId:30,cellId:213},{gfxId:31,cellId:213,showUnder:true}])
})
