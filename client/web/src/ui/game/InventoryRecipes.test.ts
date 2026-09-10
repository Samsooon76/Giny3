import { describe, expect, it } from 'vitest'
import { recipeAvailability } from './InventoryRecipes'
import type { HudItem } from '../../giny/types'
const ingredient = (quantity: number, equipped = false): HudItem => ({ uid: quantity, gid: 10, quantity, equipped, name: 'Bois', level: 1, position: equipped ? 1 : 63, appearance_id: 0 })
describe('inventory recipe availability', () => {
  it('aggregates bag stacks and excludes equipment', () => {
    const result = recipeAvailability({ resultId: 20, ingredientIds: [10], quantities: [3] }, [ingredient(4), ingredient(2), ingredient(12, true)])
    expect(result.crafts).toBe(2)
    expect(result.missing).toBe(0)
  })
  it('counts missing ingredient types and aggregates duplicate requirements', () => {
    const result = recipeAvailability({ resultId: 20, ingredientIds: [10, 10, 11], quantities: [2, 3, 1] }, [ingredient(4)])
    expect(result.crafts).toBe(0)
    expect(result.missing).toBe(2)
  })
  it('does not report infinite crafts for empty recipes', () => {
    expect(recipeAvailability({ resultId: 20 }, []).crafts).toBe(0)
  })
})
