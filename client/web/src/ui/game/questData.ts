import type { CatalogQuestObjectives } from './catalog'
type Row = { id: number; [key: string]: unknown }
export function joinQuestObjectives(quests: Record<string,Row>, steps: Record<string,Row>, objectives: Record<string,Row>, types: Record<string,Row>, npcs: Record<string,Row>, strings: Record<string,string> = {}): Record<string,CatalogQuestObjectives> {
  const result: Record<string,CatalogQuestObjectives> = {}
  const text = (id:unknown) => strings[String(id)] ?? ''
  for(const quest of Object.values(quests)) {
    const first = (quest.stepIds as number[] | undefined)?.[0]
    const step = steps[String(first)]
    if(!step)continue
    result[String(quest.id)] = {id:quest.id,stepId:step.id,description:text(step.descriptionId),objectives:((step.objectiveIds as number[])??[]).flatMap(id=>{
      const objective=objectives[String(id)]
      if(!objective)return []
      const p=objective.parameters as Record<string,number> | undefined
      const type=Number(objective.typeId)
      const first=p?.parameter0
      const name=type===1?text(npcs[String(first)]?.nameId):text(first)
      const pattern=text(types[String(type)]?.nameId)
      const caption=pattern.replace(/#(\d+)/g,(_,n:string)=>Number(n)===1?(name||String(first??'')):String(p?.[`parameter${Number(n)-1}`]??''))
      return caption?[{id,text:caption}]:[]
    })}
  }
  return result
}
