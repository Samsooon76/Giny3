import { afterEach, expect, it, vi } from 'vitest'
import { SHORTCUT_SECTIONS, keyLabel } from './shortcutPreferences'
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })
it('contains the complete quick bars and unique actions', () => {
  const rows = SHORTCUT_SECTIONS.flatMap(section => section.rows)
  expect(new Set(rows.map(row => row.id)).size).toBe(rows.length)
  const quick = SHORTCUT_SECTIONS.find(section => section.title === 'Barres de raccourcis rapides')!.rows
  expect(quick.filter(row => row.label.startsWith('Emplacement'))).toHaveLength(36)
  expect(quick.filter(row => row.label.startsWith('Page '))).toHaveLength(12)
})
it('keeps profiles separate and can reset one assignment without losing the rest', async () => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })
  vi.resetModules()
  const { shortcutPreferences: store } = await import('./shortcutPreferences')
  store.set('s1-0', 'F8'); store.set('s1-1', 'F9')
  store.profile('Profil 2'); expect(store.get('s1-0')).toBe('C')
  store.profile('Profil 1'); expect(store.get('s1-0')).toBe('F8')
  store.reset(['s1-0']); expect(store.get('s1-0')).toBe('C'); expect(store.get('s1-1')).toBe('F9')
  store.set('s0-0', 'F10'); expect(store.get('s0-0')).toBe('Échap')
})
it('normalizes captured combinations to the same format used by menu dispatch', () => {
  expect(keyLabel({ key: 'C', shiftKey: true, ctrlKey: false, metaKey: false, altKey: false })).toBe('Maj + C')
  expect(keyLabel({ key: 'PageDown', shiftKey: false, ctrlKey: true, metaKey: false, altKey: false })).toBe('Ctrl + Page suivante')
})
