import { describe, expect, it } from 'vitest'
import { parseQuestModuleState } from './questState'

const state = {
  serverUnix: 1, dailyResetUnix: 2, weeklyResetUnix: 3,
  daily: { quests: [{ id: 1, title: 'Récolter', description: 'Du blé', currentAmount: 1, targetAmount: 2, expiresUnix: 2,
    completed: false, rewardClaimed: false, rewards: [{ label: '10 kamas', amount: 10 }] }] },
  weekly: { quests: [] }, unclaimed: [],
  battlePass: { seasonName: '', level: 1, currentXp: 0, xpRequired: 1000, levels: [] },
}
const envelope = (s: unknown) => JSON.stringify({ schemaVersion: 1, module: 'quests', characterId: '42', state: s })
describe('état des quêtes de module', () => {
  it('conserve les données Giny et l’identité de leur personnage', () => {
    expect(parseQuestModuleState(envelope(state))).toEqual({ characterId: '42', state })
  })
  it('rejette une progression invalide et des collections incomplètes', () => {
    expect(parseQuestModuleState(envelope({ ...state, daily: { quests: [{ ...state.daily.quests[0], targetAmount: 0 }] } }))).toBeNull()
    expect(parseQuestModuleState(envelope({ ...state, battlePass: { levels: [] } }))).toBeNull()
    expect(parseQuestModuleState('{broken')).toBeNull()
  })
  it('rejette les modules ou versions inconnus et les identités numériques', () => {
    const valid = JSON.parse(envelope(state))
    for (const patch of [{ schemaVersion: 2 }, { module: 'other' }, { characterId: 42 }])
      expect(parseQuestModuleState(JSON.stringify({ ...valid, ...patch }))).toBeNull()
  })
})
