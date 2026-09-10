import { useEffect, useState } from 'react'
import type { MonsterGroupInfo, MonsterGroupMember } from '../../giny/types'
import { item, itemIcon, uiFormat, uiString } from './catalog'

/** Dofus PvM group XP multipliers, indexed by qualifying party size − 1. */
export const XP_GROUP = [1, 1.1, 1.5, 2.3, 3.1, 3.6, 4.2, 4.7]

export type CatalogMonsterGrade = {
  grade?: number
  gradeId?: number
  level?: number
  gradeXp?: number
}

export type CatalogMonsterDrop = {
  objectId: number
  hasCriterions?: number | boolean
  percentDropForGrade1?: number
  percentDropForGrade2?: number
  percentDropForGrade3?: number
  percentDropForGrade4?: number
  percentDropForGrade5?: number
}

export type CatalogMonster = {
  id: number
  isBounty?: boolean
  grades?: CatalogMonsterGrade[]
  drops?: CatalogMonsterDrop[]
}

export type MonsterGroupLoot = {
  gid: number
  name: string
  icon?: string
  criterion: boolean
}

export type MonsterGroupLine = MonsterGroupMember & {
  bounty?: boolean
}

export type MonsterGroupSummary = {
  level: number
  xp: number
  groupXp?: number
  kamas: number
  members: MonsterGroupLine[]
  loots: MonsterGroupLoot[]
}

let monstersPending: Promise<Map<number, CatalogMonster>> | undefined

export function loadMonsterCatalog(fetcher: typeof fetch = fetch): Promise<Map<number, CatalogMonster>> {
  return monstersPending ??= fetcher('/game-data/data/monsters.json')
    .then((response) => {
      if (!response.ok) throw new Error('Catalogue monstres indisponible')
      return response.json() as Promise<Record<string, CatalogMonster>>
    })
    .then((rows) => {
      const map = new Map<number, CatalogMonster>()
      for (const row of Object.values(rows)) {
        if (row && typeof row.id === 'number') map.set(row.id, row)
      }
      return map
    })
    .catch((error) => {
      monstersPending = undefined
      throw error
    })
}

export function resetMonsterCatalog(): void {
  monstersPending = undefined
}

export function useMonsterCatalog(): Map<number, CatalogMonster> | undefined {
  const [monsters, setMonsters] = useState<Map<number, CatalogMonster>>()
  useEffect(() => {
    let alive = true
    void loadMonsterCatalog().then((value) => { if (alive) setMonsters(value) }).catch(() => undefined)
    return () => { alive = false }
  }, [])
  return monsters
}

export function groupLevel(members: MonsterGroupMember[]): number {
  return members.reduce((sum, member) => sum + member.level, 0)
}

export function dropPercent(drop: CatalogMonsterDrop, grade: number): number {
  const rates = [
    drop.percentDropForGrade1,
    drop.percentDropForGrade2,
    drop.percentDropForGrade3,
    drop.percentDropForGrade4,
    drop.percentDropForGrade5,
  ]
  const index = Math.min(5, Math.max(1, grade || 1)) - 1
  return Number(rates[index] ?? 0)
}

export function monsterGrade(monster: CatalogMonster | undefined, gradeId: number): CatalogMonsterGrade | undefined {
  const grades = monster?.grades ?? []
  return grades.find((row) => (row.grade ?? row.gradeId) === gradeId) ?? grades[0]
}

export function estimateKamas(members: MonsterGroupMember[]): number {
  return members.reduce((sum, member) => sum + Math.max(1, member.level), 0)
}

function truncate(value: number): number {
  return Math.trunc(value)
}

/** Level-gap coefficient from Giny `FightFormulas.GetExperiencePvM`. */
export function levelGapCoefficient(actorLevel: number, monsterLevels: number): number {
  if (actorLevel - 5 > monsterLevels) return monsterLevels / actorLevel
  if (actorLevel + 10 < monsterLevels) return (actorLevel + 10) / monsterLevels
  return 1
}

export function applyXpPreview(baseXp: number, monsterLevels: number, playerLevel?: number, partySize?: number): { xp: number; groupXp?: number } {
  const soloCoeff = playerLevel != null ? levelGapCoefficient(playerLevel, monsterLevels) : 1
  const xp = truncate(baseXp * soloCoeff)
  const size = partySize && partySize > 1 ? Math.min(partySize, XP_GROUP.length) : 0
  if (!size) return { xp }
  const groupCoeff = playerLevel != null ? levelGapCoefficient(playerLevel * size, monsterLevels) : 1
  return { xp, groupXp: truncate(baseXp * XP_GROUP[size - 1] * groupCoeff) }
}

export function summarizeMonsterGroup(
  group: MonsterGroupInfo,
  monsters?: Map<number, CatalogMonster>,
  options: { playerLevel?: number; partySize?: number } = {},
): MonsterGroupSummary {
  const members = group.members
  const level = groupLevel(members)
  let baseXp = group.xp ?? 0
  if (!(baseXp > 0) && monsters) {
    baseXp = members.reduce((sum, member) => {
      const grade = monsterGrade(monsters.get(member.id), member.grade)
      return sum + Number(grade?.gradeXp ?? 0)
    }, 0)
  }
  const kamas = group.kamas && group.kamas > 0 ? group.kamas : estimateKamas(members)
  const { xp, groupXp } = applyXpPreview(baseXp, level, options.playerLevel, options.partySize)
  const lootIds = new Map<number, boolean>()
  if (monsters) {
    for (const member of members) {
      const row = monsters.get(member.id)
      for (const drop of row?.drops ?? []) {
        if (drop.objectId <= 0 || dropPercent(drop, member.grade) <= 0) continue
        lootIds.set(drop.objectId, lootIds.get(drop.objectId) === true || Boolean(drop.hasCriterions))
      }
    }
  }
  if (!lootIds.size && group.drops?.length) {
    for (const gid of group.drops) {
      if (gid > 0) lootIds.set(gid, false)
    }
  }
  const loots: MonsterGroupLoot[] = [...lootIds.entries()].map(([gid, criterion]) => {
    const catalog = item(gid)
    const icon = itemIcon({ gid, icon_id: catalog?.iconId })
      ?? (catalog?.iconId ? `/game-data/pictos/items/${catalog.iconId}.png` : undefined)
    return { gid, name: catalog?.name ?? `Objet ${gid}`, icon, criterion }
  })
  return {
    level,
    xp,
    groupXp,
    kamas,
    members: members.map((member) => ({
      ...member,
      bounty: Boolean(monsters?.get(member.id)?.isBounty),
    })),
    loots,
  }
}

export function monsterGroupHeader(level: number): string {
  const label = uiString('ui.common.level') ?? 'Niveau'
  return `${label} ${level}`
}

export function monsterXpLabel(xp: number): string {
  return uiFormat('ui.tooltip.monsterXpAlone', formatGroupNumber(xp)) ?? `${formatGroupNumber(xp)} XP`
}

export function monsterGroupXpLabel(xp: number): string {
  return `${formatGroupNumber(xp)} (Groupe)`
}

export function monsterLevelLabel(level: number): string {
  return `Niv. ${level}`
}

export function specificLootLabel(): string {
  return 'Butins spécifiques'
}

function formatGroupNumber(value: number): string {
  return Math.trunc(value).toLocaleString('fr-FR')
}
