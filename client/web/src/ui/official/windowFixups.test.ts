import { afterEach, expect, it } from 'vitest'
import { WINDOW_FIXUPS, windowFixup } from './windowFixups'

afterEach(() => {
  for (const key of Object.keys(WINDOW_FIXUPS)) delete WINDOW_FIXUPS[key]
})

it('leaves every node alone until a window is actually corrected', () => {
  expect(windowFixup('hud_inventory', 'ctr_items', 'ctr_items')).toBeUndefined()
})

it('matches on the authored name before the binding', () => {
  // A binding repeats across the clones of a template, so the name is the more
  // precise key and has to win.
  WINDOW_FIXUPS.hud_inventory = {
    ctr_items: { style: { 'flex-direction': 'row' } },
    itemTile: { style: { 'flex-direction': 'column' } },
  }
  expect(windowFixup('hud_inventory', 'ctr_items', 'itemTile')?.style).toEqual({ 'flex-direction': 'row' })
  expect(windowFixup('hud_inventory', undefined, 'itemTile')?.style).toEqual({ 'flex-direction': 'column' })
})

it('keeps a correction inside its own window', () => {
  WINDOW_FIXUPS.hud_inventory = { ctr_items: { style: { display: 'flex' } } }
  expect(windowFixup('hud_map', 'ctr_items', undefined)).toBeUndefined()
  expect(windowFixup(undefined, 'ctr_items', undefined)).toBeUndefined()
})

it('lets a window override the wildcard rather than replace it', () => {
  WINDOW_FIXUPS['*'] = { scrollbar: { style: { width: { value: 8, unit: 'px' } }, sprite: 'generic' } }
  WINDOW_FIXUPS.hud_map = { scrollbar: { style: { 'background-color': '#101010' } } }
  expect(windowFixup('hud_map', 'scrollbar', undefined)).toEqual({
    style: { width: { value: 8, unit: 'px' }, 'background-color': '#101010' },
    sprite: 'generic',
  })
  // A window that says nothing still gets the global correction.
  expect(windowFixup('hud_guild', 'scrollbar', undefined)?.sprite).toBe('generic')
})
