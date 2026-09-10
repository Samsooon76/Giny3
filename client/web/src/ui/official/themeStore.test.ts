import { afterEach, expect, it, vi } from 'vitest'
import { existsSync } from 'node:fs'
import { UI_THEMES, validTheme } from './themeStore'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })
it('ships complete official palettes and both assets for every theme', () => {
  expect(UI_THEMES).toHaveLength(11)
  for (const theme of UI_THEMES) {
    for (const key of ['--background_dark100', '--highlight_primary100', '--buttons_buttonPrimary']) {
      expect(theme.tokens[key as keyof typeof theme.tokens]).toMatch(/^#[0-9a-f]{8}$/i)
    }
    expect(existsSync(`public${theme.image}`)).toBe(true)
    expect(existsSync(`public${theme.ornament}`)).toBe(true)
  }
  expect(validTheme('missing-theme')).toBe('Standard')
})
it('restores the selection, persists changes and resets to Standard', async () => {
  const storage = new Map([['giny.ui-theme.v1', 'Brakmar']])
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) })
  vi.resetModules()
  const { themeStore } = await import('./themeStore')
  expect(themeStore.snapshot()).toBe('Brakmar')
  themeStore.select('Bonta')
  expect(storage.get('giny.ui-theme.v1')).toBe('Bonta')
  themeStore.reset()
  expect(themeStore.snapshot()).toBe('Standard')
  expect(storage.get('giny.ui-theme.v1')).toBe('Standard')
})
it('still switches themes when browser storage is unavailable', async () => {
  vi.stubGlobal('localStorage', { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } })
  vi.resetModules()
  const { themeStore } = await import('./themeStore')
  themeStore.select('Unicorn')
  expect(themeStore.snapshot()).toBe('Unicorn')
})
