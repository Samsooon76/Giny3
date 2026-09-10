import { beforeEach, describe, expect, it } from 'vitest'
import { worldmapViewStore } from './worldmapStore'

describe('cartography markers and filters', () => {
  beforeEach(() => worldmapViewStore.reset())
  it('adds a unique marker on the clicked map and enables its filter', () => {
    worldmapViewStore.setFilters([])
    worldmapViewStore.addMarker(2, 3, -4)
    worldmapViewStore.addMarker(2, 3, -4)
    expect(worldmapViewStore.snapshot().markers).toEqual([{ worldmapId: 2, x: 3, y: -4 }])
    expect(worldmapViewStore.snapshot().filters.has(8)).toBe(true)
  })
  it('hides markers without deleting them and removes all on request', () => {
    worldmapViewStore.addMarker(2, 3, -4)
    worldmapViewStore.addMarker(1, 3, -4)
    worldmapViewStore.toggleFilter(8)
    expect(worldmapViewStore.snapshot().markers).toHaveLength(2)
    expect(worldmapViewStore.snapshot().filters.has(8)).toBe(false)
    worldmapViewStore.clearMarkers()
    expect(worldmapViewStore.snapshot().markers).toEqual([])
  })
})
