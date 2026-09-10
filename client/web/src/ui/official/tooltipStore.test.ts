import { afterEach, describe, expect, it, vi } from 'vitest'
import { OFFICIAL_CANVAS } from './surface'
import {
  chatTooltip, officialUid, placeTooltip, textTooltip, tooltipResolve, tooltipStore, wantsElidedTooltip,
} from './tooltipStore'

const rect = { x: 100, y: 100, w: 40, h: 40 }

afterEach(() => {
  vi.useRealTimers()
  tooltipStore.hide()
})

describe('official node ids', () => {
  it('prefixes the tree name so two slot_0 do not share a hover selector', () => {
    const bar = officialUid('actionBar', 'gd_spellitemotes:0', 'slot_0', 'slot_0')
    const bag = officialUid('equipmentStorageUi', 'grid:0', 'slot_0', 'slot_0')
    expect(bar).not.toBe(bag)
    expect(bar).toContain('actionBar')
    expect(bag).toContain('equipmentStorageUi')
  })
})

describe('tooltip placement', () => {
  it('sits below the source when the canvas has room', () => {
    expect(placeTooltip({ x: 100, y: 100, w: 40, h: 40 }, { w: 200, h: 60 })).toEqual({ left: 100, top: 148 })
  })

  it('flips above a source on the action bar and clamps to the canvas', () => {
    const slot = { x: 700, y: 1000, w: 48, h: 48 }
    const pos = placeTooltip(slot, { w: 300, h: 120 })
    expect(pos.top + 120).toBeLessThanOrEqual(OFFICIAL_CANVAS.height)
    expect(pos.top).toBeLessThan(slot.y)
    expect(pos.left).toBeGreaterThanOrEqual(0)
    expect(pos.left + 300).toBeLessThanOrEqual(OFFICIAL_CANVAS.width)
  })

  it('clamps a tooltip that would overflow the right edge', () => {
    const pos = placeTooltip({ x: 1800, y: 40, w: 50, h: 20 }, { w: 400, h: 80 })
    expect(pos.left).toBe(OFFICIAL_CANVAS.width - 400)
    expect(pos.top).toBe(68)
  })
})

describe('tooltip store', () => {
  it('waits for the hover-intent delay, then opens', () => {
    vi.useFakeTimers()
    tooltipStore.show({ source: 'a', tree: 'TextTooltip', text: 'PA', rect, delay: 400 })
    expect(tooltipStore.snapshot()).toBeNull()
    vi.advanceTimersByTime(399)
    expect(tooltipStore.snapshot()).toBeNull()
    vi.advanceTimersByTime(1)
    expect(tooltipStore.snapshot()?.text).toBe('PA')
  })

  it('cancels a pending open on leave, and ignores a leave from another source', () => {
    vi.useFakeTimers()
    tooltipStore.show({ source: 'a', tree: 'TextTooltip', text: 'PA', rect, delay: 400 })
    tooltipStore.hide('a')
    vi.advanceTimersByTime(400)
    expect(tooltipStore.snapshot()).toBeNull()
    tooltipStore.show({ source: 'b', tree: 'TextTooltip', text: 'PM', rect, delay: 0 })
    tooltipStore.hide('a')
    expect(tooltipStore.snapshot()?.source).toBe('b')
  })

  it('switches immediately when a tooltip is already open', () => {
    vi.useFakeTimers()
    tooltipStore.show({ source: 'a', tree: 'TextTooltip', text: 'PA', rect, delay: 0 })
    tooltipStore.show({ source: 'b', tree: 'TextTooltip', text: 'PM', rect, delay: 400 })
    expect(tooltipStore.snapshot()?.text).toBe('PM')
  })
})

describe('TextTooltip bindings', () => {
  it('fills text and hides the shortcut unless one is given', () => {
    const plain = textTooltip("Points d'action")
    expect(plain.resolve?.('text')?.text).toBe("Points d'action")
    expect(plain.resolve?.('shortcut')?.hidden).toBe(true)
    const keyed = textTooltip('Personnage', 'C')
    expect(keyed.resolve?.('shortcut')).toMatchObject({ hidden: false, text: 'C' })
    const request = { source: 'x', tree: 'TextTooltip', text: 'Chat', rect }
    expect(tooltipResolve(request)('text')?.text).toBe('Chat')
    expect(tooltipResolve(request)('shortcut')?.hidden).toBe(true)
  })

  it('fills ChatTooltip #lbl_text', () => {
    const tip = chatTooltip('Hugo : salut')
    expect(tip.tree).toBe('ChatTooltip')
    expect(tip.resolve?.('lbl_text')?.text).toBe('Hugo : salut')
    const request = { source: 'c', tree: 'ChatTooltip', text: 'Hugo : salut', rect }
    expect(tooltipResolve(request)('lbl_text')?.text).toBe('Hugo : salut')
  })

  it('reads display-tooltip-when-elided the way the extractor spells it', () => {
    expect(wantsElidedTooltip({ properties: { 'display-tooltip-when-elided': 'true' } })).toBe(true)
    expect(wantsElidedTooltip({ properties: { displayTooltipWhenElided: '1' } })).toBe(true)
    expect(wantsElidedTooltip({ properties: { 'display-tooltip-when-elided': 'false' } })).toBe(false)
  })
})
