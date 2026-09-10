import { expect, it } from 'vitest'
import { collectDamagePreview } from './SpellDamagePreview'

it('keeps elements, critical rolls, heals and targets separate while adding repeated hits',()=>{
  const hit=(elemId:number,min:number,max:number,isCritical=false,isHeal=false)=>({damageRange:{elemId,min,max,isCritical,isHeal}})
  expect(collectDamagePreview([
    {id:1,effects:[hit(4,10,20),hit(4,2,3),hit(1,5,8),hit(4,15,30,true),hit(4,3,6,false,true),{}]},
    {id:2,effects:[hit(4,7,14)]},
  ])).toEqual([
    {id:1,element:4,min:12,max:23,critical:false,heal:false},
    {id:1,element:1,min:5,max:8,critical:false,heal:false},
    {id:1,element:4,min:15,max:30,critical:true,heal:false},
    {id:1,element:4,min:3,max:6,critical:false,heal:true},
    {id:2,element:4,min:7,max:14,critical:false,heal:false},
  ])
})
