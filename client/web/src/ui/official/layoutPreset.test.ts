import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { HUD_LAYOUT, HUD_LAYOUT_VERSION } from '../game/hudLayout'
import { OFFICIAL_CANVAS } from './surface'

let disk: Map<string, string>
beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  disk = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => disk.get(key) ?? null,
    setItem: (key: string, value: string) => disk.set(key, value),
  })
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('migrates existing HUD geometry once, backs it up and preserves other windows', async () => {
  const old = { Chat: { x: 0, y: 700, w: 400, h: 380, docked: ['w', 's'] },
    inventory: { x: 300, y: 20, w: 900, h: 850, docked: [] } }
  disk.set('giny.ui.layout.v2', JSON.stringify(old))
  const { layoutStore } = await import('./layoutStore')
  layoutStore.applyPreset(HUD_LAYOUT_VERSION, HUD_LAYOUT, OFFICIAL_CANVAS)
  expect(layoutStore.get('Chat')).toMatchObject(HUD_LAYOUT.Chat)
  expect(layoutStore.get('inventory')).toEqual(old.inventory)
  expect(JSON.parse(disk.get(`giny.ui.layout.v2.preset.${HUD_LAYOUT_VERSION}.backup`)!)).toEqual(old)

  layoutStore.set('Chat', { ...layoutStore.get('Chat')!, x: 80 })
  await vi.runAllTimersAsync()
  vi.resetModules()
  const reloaded = (await import('./layoutStore')).layoutStore
  reloaded.applyPreset(HUD_LAYOUT_VERSION, HUD_LAYOUT, OFFICIAL_CANVAS)
  expect(reloaded.get('Chat')?.x).toBe(80)
})

it('keeps all reference widgets on screen and the bottom panels adjacent', () => {
  for (const rect of Object.values(HUD_LAYOUT)) {
    expect(rect.x).toBeGreaterThanOrEqual(0)
    expect(rect.y).toBeGreaterThanOrEqual(0)
    expect(rect.x + rect.w).toBeLessThanOrEqual(OFFICIAL_CANVAS.width)
    expect(rect.y + rect.h).toBeLessThanOrEqual(OFFICIAL_CANVAS.height)
  }
  const { Chat, CharacterInformations, ActionBar, widgetProgressGauge } = HUD_LAYOUT
  expect(Chat.x + Chat.w).toBe(CharacterInformations.x)
  expect(CharacterInformations.x + CharacterInformations.w).toBe(ActionBar.x)
  expect(ActionBar.y + ActionBar.h).toBe(widgetProgressGauge.y)
})

it('migrates the old chat density once while preserving later font choices', async () => {
  disk.set('giny.module-options.v1', JSON.stringify({ chat: { chatFont: 16, timestamps: false } }))
  const { moduleOptions } = await import('./moduleOptions')
  moduleOptions.applyChatDensityPreset(HUD_LAYOUT_VERSION)
  expect(moduleOptions.get('Chat')).toMatchObject({ chatFont: 14, timestamps: false })
  moduleOptions.set('Chat', { chatFont: 18 })
  vi.resetModules()
  const reloaded = (await import('./moduleOptions')).moduleOptions
  reloaded.applyChatDensityPreset(HUD_LAYOUT_VERSION)
  expect(reloaded.get('Chat').chatFont).toBe(18)
})
