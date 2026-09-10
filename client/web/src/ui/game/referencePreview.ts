import type { CharacterHud } from '../../giny/types'
import { PREVIEW_HUD } from './hudBindings'

/** Reference-workshop fixtures; never substituted for a connected snapshot. */
export const REFERENCE_HUD: CharacterHud = {
  ...PREVIEW_HUD,
  achievement_points:118,
  jobs:[[16,'Bijoutier',46,365,920],[28,'Paysan',4,43,80],[41,'Chasseur',3,40,60],[27,'Tailleur',3,40,60],[11,'Forgeron',2,0,40],[26,'Alchimiste',1,0,20],[2,'Bûcheron',1,0,20],[24,'Mineur',1,0,20],[36,'Pêcheur',1,0,20],[65,'Bricoleur',1,0,20],[15,'Cordonnier',1,0,20]].map(([id,name,level,xp,next])=>({id:Number(id),name:String(name),level:Number(level),experience:Number(xp),experience_floor:0,experience_next:Number(next)})),
  guild: { id: 1, name: 'Guilde Giny', level: 3, experience: 45, experience_floor: 0, experience_next: 100, motd: '', kamas: 620, members: [{ id: 1, name: 'Hugo', level: 200, breed_id: 1, online: true, rank: 'À l’essai', achievement_points: 118 }] },
  quests: [{id:1958,name:"Les principes d'Archie m'aident",remaining:1,objectiveIds:[14257],rewards:{kamas:151,experience:6225,items:[{gid:6898,quantity:1}]}}],
}

/** Local chat workshop samples; never inserted into the server chat store. */
export const REFERENCE_CHAT: import('../../giny/types').ChatLine[] = [
 {id:'preview-info',kind:'info',channel:0,content:'Bienvenue sur Giny !',timestamp:new Date(2026,8,5,10,26).getTime()},
 {id:'preview-local',kind:'message',channel:0,sender:'Hugo',content:'Bonjour !',timestamp:new Date(2026,8,5,10,27).getTime()},
 {id:'preview-guild',kind:'message',channel:2,sender:'Hugo',content:'Le canal de guilde est prêt.',timestamp:new Date(2026,8,5,10,28).getTime()},
 {id:'preview-recruit',kind:'message',channel:6,sender:'Hugo',content:'Recherche de groupe pour un donjon.',timestamp:new Date(2026,8,5,10,29).getTime()},
]
