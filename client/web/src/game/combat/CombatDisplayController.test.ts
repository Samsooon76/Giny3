import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { CombatDisplayController } from './CombatDisplayController'
import type { Container } from 'pixi.js'

function layer(visible = true): Container {
  return { visible, destroyed: false } as unknown as Container
}

const store = new Map<string, string>()

describe('CombatDisplayController', () => {
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
      clear: () => store.clear(),
    })
  })
  afterEach(() => vi.unstubAllGlobals())
  it('starts with tactical mode and grid off, independently switchable', () => {
    const display = new CombatDisplayController()
    expect(display.tactical).toBe(false)
    expect(display.grid).toBe(false)
    expect(display.toggleTactical()).toBe(true)
    expect(display.grid).toBe(false)
    expect(display.toggleGrid()).toBe(true)
    expect(display.tactical).toBe(true)
  })
  it('hides only registered occlusive layers and restores their exact visibility', () => {
    const display = new CombatDisplayController()
    const occlusive = layer(true), background = layer(true)
    display.registerTacticalLayers([occlusive])
    display.setTactical(true)
    display.applyTactical()
    expect(occlusive.visible).toBe(false)
    expect(background.visible).toBe(true)
    expect(display.hiddenLayerCount).toBe(1)
    display.setTactical(false)
    display.restoreDecor()
    expect(occlusive.visible).toBe(true)
    expect(display.hiddenLayerCount).toBe(0)
  })
  it('hides nothing while the official layer classification is pending', () => {
    const display = new CombatDisplayController()
    const decor = layer(true)
    display.setTactical(true)
    display.applyTactical()
    expect(decor.visible).toBe(true)
    expect(display.hiddenLayerCount).toBe(0)
  })
  it('persists preferences across sessions', () => {
    const display = new CombatDisplayController()
    display.setTactical(true)
    display.setGrid(true)
    const next = new CombatDisplayController()
    expect(next.tactical).toBe(true)
    expect(next.grid).toBe(true)
  })
})
