import { expect, it } from 'vitest'
import { joinQuestObjectives } from './questData'

it('joins raw objectives through the first step and resolves NPC names', () => {
  const result=joinQuestObjectives(
    {'1958':{id:1958,stepIds:[2628]}},
    {'2628':{id:2628,descriptionId:10,objectiveIds:[14257,13849]}},
    {'14257':{id:14257,typeId:1,parameters:{parameter0:4355}},'13849':{id:13849,typeId:0,parameters:{parameter0:50}}},
    {'1':{id:1,nameId:30},'0':{id:0,nameId:40}},
    {'4355':{id:4355,nameId:20}},
    {'10':'Description','20':'Envoyée des Douze','30':'Aller voir #1','40':'#1','50':'Entrer dans la Tour'},
  )
  expect(result['1958']).toEqual({id:1958,stepId:2628,description:'Description',objectives:[{id:14257,text:'Aller voir Envoyée des Douze'},{id:13849,text:'Entrer dans la Tour'}]})
})

it('does not invent an objective when the step is unavailable', () => {
  expect(joinQuestObjectives({'1':{id:1,stepIds:[99]}},{},{},{},{},{})).toEqual({})
})
