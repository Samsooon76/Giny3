import { beforeEach, describe, expect, it } from 'vitest'
import { layoutStore } from '../official/layoutStore'
import { HUD_MODULES, moduleVisible, setModuleVisible } from './hudWidgetManager'

describe('module visibility controls', () => {
  beforeEach(() => layoutStore.reset())
  it('restores a hidden module without moving or resizing it', () => {
    const layout = { x: 50, y: 600, w: 480, h: 260, docked: [], z: 5, reducedHeader: true }
    layoutStore.set('Chat', layout)
    setModuleVisible('Chat', false)
    expect(moduleVisible('Chat')).toBe(false)
    setModuleVisible('Chat', true)
    expect(layoutStore.get('Chat')).toEqual({ ...layout, hidden: false })
  })
  it('keeps the manager usable after hiding every module and restores every module', () => {
    for (const module of HUD_MODULES) setModuleVisible(module.id, false)
    expect(HUD_MODULES.every(module => !moduleVisible(module.id))).toBe(true)
    expect(layoutStore.get('widgetManager')).toBeUndefined()
    for (const module of HUD_MODULES) setModuleVisible(module.id, true)
    expect(HUD_MODULES.every(module => moduleVisible(module.id))).toBe(true)
  })
  it('leaves emotes hidden until requested, including before their first mount', () => {
    expect(moduleVisible('Smiley')).toBe(false)
    setModuleVisible('Smiley', true)
    expect(moduleVisible('Smiley')).toBe(true)
    expect(layoutStore.get('Smiley')?.w).toBe(390)
  })
})
