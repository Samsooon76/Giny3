import { afterEach, expect, it } from 'vitest'
import type { MonsterGroupInfo } from '../../giny/types'
import { hydrateCatalog, resetCatalog } from './catalog'
import {
  applyXpPreview,
  dropPercent,
  estimateKamas,
  groupLevel,
  levelGapCoefficient,
  monsterGrade,
  monsterGroupHeader,
  monsterLevelLabel,
  monsterXpLabel,
  resetMonsterCatalog,
  summarizeMonsterGroup,
  type CatalogMonster,
  XP_GROUP,
} from './monsterGroupTooltip'

afterEach(() => {
  resetCatalog()
  resetMonsterCatalog()
})

const members = [
  { id: 10, name: 'Feu de Joie', level: 1, grade: 1, look: '' },
  { id: 11, name: 'Feu Furieux', level: 4, grade: 2, look: '' },
  { id: 11, name: 'Feu Furieux', level: 1, grade: 1, look: '' },
  { id: 11, name: 'Feu Furieux', level: 1, grade: 1, look: '' },
  { id: 11, name: 'Feu Furieux', level: 2, grade: 1, look: '' },
]

const group = (extra: Partial<MonsterGroupInfo> = {}): MonsterGroupInfo => ({
  attackable: true,
  modular: false,
  members,
  ...extra,
})

const monsters = new Map<number, CatalogMonster>([
  [10, {
    id: 10,
    grades: [{ grade: 1, level: 1, gradeXp: 40 }],
    drops: [
      { objectId: 100, percentDropForGrade1: 15 },
      { objectId: 101, percentDropForGrade1: 0 },
    ],
  }],
  [11, {
    id: 11,
    isBounty: true,
    grades: [
      { grade: 1, level: 1, gradeXp: 50 },
      { grade: 2, level: 4, gradeXp: 90 },
    ],
    drops: [
      { objectId: 100, percentDropForGrade1: 10, percentDropForGrade2: 20 },
      { objectId: 200, percentDropForGrade1: 5, hasCriterions: 1 },
      { objectId: 201, percentDropForGrade1: 0, percentDropForGrade2: 8 },
    ],
  }],
])

it('sums monster levels for the group header', () => {
  expect(groupLevel(members)).toBe(9)
  expect(monsterGroupHeader(9)).toBe('Niveau 9')
  expect(monsterLevelLabel(4)).toBe('Niv. 4')
})

it('reads the matching grade XP and drop rate', () => {
  expect(monsterGrade(monsters.get(11), 2)?.gradeXp).toBe(90)
  expect(dropPercent({ objectId: 1, percentDropForGrade2: 8 }, 2)).toBe(8)
  expect(dropPercent({ objectId: 1, percentDropForGrade1: 3 }, 9)).toBe(0)
})

it('estimates kamas from levels when the server sends none', () => {
  expect(estimateKamas(members)).toBe(9)
})

it('builds XP, unique specific loot and criterion flags from the catalogue', () => {
  hydrateCatalog({ items: { '100': { id: 100, name: 'Peau', iconId: 1 }, '200': { id: 200, name: 'Anneau', iconId: 2 } } })
  const summary = summarizeMonsterGroup(group(), monsters)
  expect(summary.level).toBe(9)
  expect(summary.xp).toBe(40 + 90 + 50 + 50 + 50)
  expect(summary.kamas).toBe(9)
  expect(summary.groupXp).toBeUndefined()
  expect(summary.members[1]?.bounty).toBe(true)
  expect(summary.loots.map((loot) => loot.gid).sort((a, b) => a - b)).toEqual([100, 200, 201])
  expect(summary.loots.find((loot) => loot.gid === 200)?.criterion).toBe(true)
  expect(summary.loots.find((loot) => loot.gid === 100)?.name).toBe('Peau')
})

it('prefers live XP / kamas / drop ids from the map snapshot', () => {
  const summary = summarizeMonsterGroup(group({ xp: 300, kamas: 12, drops: [7, 8] }), undefined)
  expect(summary.xp).toBe(300)
  expect(summary.kamas).toBe(12)
  expect(summary.loots.map((loot) => loot.gid)).toEqual([7, 8])
})

it('applies the PvM level gap and party multiplier', () => {
  expect(levelGapCoefficient(1, 9)).toBe(1)
  expect(levelGapCoefficient(50, 9)).toBeCloseTo(9 / 50)
  expect(applyXpPreview(300, 9, 1).xp).toBe(300)
  expect(applyXpPreview(300, 9, 1, 3).groupXp).toBe(truncate(300 * XP_GROUP[2]))
  expect(monsterXpLabel(300)).toBe('300 XP')
})

function truncate(value: number): number {
  return Math.trunc(value)
}
