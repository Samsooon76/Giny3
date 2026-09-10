import { describe, expect, it } from 'vitest'
import { cssText } from './uss'
import { cascadeKeys, hasPointerState, nodeCascadeCss, splitCascade, stateSelectors } from './cascade'
import type { VisualTreeNode } from './types'

/** A banner-menu tile container: hover is authored on the Slot ancestor. */
const tile: VisualTreeNode = {
  type: 'VisualElement',
  binding: 'itemTile_container',
  style: {
    'background-color': '#50547ecc',
    width: { value: 100, unit: '%' },
    height: { value: 100, unit: '%' },
  },
  ancestor_states: [
    {
      state: 'hover',
      depth: 1,
      style: {
        'background-color': '#a4a7c7cc',
        width: { value: 100, unit: '%' },
      },
    },
    {
      state: 'pressed',
      depth: 1,
      style: { 'background-color': '#ffffff80' },
    },
    {
      state: 'disabled',
      depth: 1,
      style: { 'background-color': '#ffffff1a' },
    },
  ],
}

const button: VisualTreeNode = {
  type: 'Slot',
  binding: 'slot_0',
  style: {
    'background-image': 'styles/images/slot_dark_background_empty.png',
    width: { value: 100, unit: '%' },
  },
  states: {
    hover: { 'background-color': 'transparent' },
    disabled: { 'background-image': 'styles/images/slot_dark_background_empty.png' },
  },
}

describe('USS cascade vs inline style', () => {
  it('moves every property a state redefines out of the inline USS', () => {
    expect([...cascadeKeys(tile)].sort()).toEqual(['background-color', 'width'])
    const { inlineUss, cssUss } = splitCascade(tile)
    expect(cssUss['background-color']).toBe('#50547ecc')
    expect(inlineUss['background-color']).toBeUndefined()
    expect(inlineUss.height).toEqual({ value: 100, unit: '%' })
    expect(cssText(cssUss)).toContain('background-color:#50547ecc')
  })

  it('emits :hover / :active / disabled rules that can beat the base colour', () => {
    const css = nodeCascadeCss('tile', tile, ['slot'])
    expect(css).toContain('[data-official-id="tile"]{')
    expect(css).toContain('background-color:#50547ecc')
    expect(css).toContain('[data-official-id="slot"]:hover [data-official-id="tile"]')
    expect(css).toContain('background-color:#a4a7c7cc')
    expect(css).toContain('[data-official-id="slot"]:active [data-official-id="tile"]')
    expect(css).toContain('[data-disabled="true"]')
    expect(css).toContain('[data-state="hover"]')
    expect(css).toContain('[data-state="pressed"]')
    expect(css).toContain('[data-state="hover"]')
    expect(css).toContain('[data-state="pressed"]')
    // The overridable colour is not left as an inline-only declaration: the
    // base and the hover share a stylesheet, so :hover wins on specificity.
    expect(css.indexOf('background-color:#50547ecc')).toBeLessThan(css.indexOf('background-color:#a4a7c7cc'))
  })

  it('keeps a node with no states fully inline', () => {
    const plain: VisualTreeNode = { style: { 'background-color': '#111', width: { value: 8, unit: 'px' } } }
    const { inlineUss, cssUss } = splitCascade(plain)
    expect(cssUss).toEqual({})
    expect(inlineUss['background-color']).toBe('#111')
    expect(nodeCascadeCss('plain', plain, [])).toBe('')
  })

  it('keeps a tinted sprite together when only the tint is state-rewritten', () => {
    const layer: VisualTreeNode = {
      binding: 'playButton_background',
      style: {
        'background-image': 'styles/images/defaultBackgoundButton.png',
        'unity-background-image-tint-color': '#8ca800ff',
        position: 'absolute',
        width: { value: 100, unit: '%' },
        height: { value: 100, unit: '%' },
      },
      ancestor_states: [{
        state: 'disabled',
        depth: 2,
        style: {
          position: 'absolute',
          width: { value: 100, unit: '%' },
          height: { value: 100, unit: '%' },
          'unity-background-image-tint-color': '#3d405ce5',
        },
      }],
    }
    const { inlineUss, cssUss } = splitCascade(layer)
    expect(cssUss['background-image']).toBe('styles/images/defaultBackgoundButton.png')
    expect(cssUss['unity-background-image-tint-color']).toBe('#8ca800ff')
    expect(inlineUss['background-image']).toBeUndefined()
    expect(inlineUss['unity-background-image-tint-color']).toBeUndefined()
    const css = nodeCascadeCss('layer', layer, ['container', 'btn_play'])
    expect(css).toContain('--official-tint')
    expect(css).toContain('--official-mask-image')
    expect(css).toContain('#8ca800ff')
    expect(css).toContain('position:absolute')
    expect(css).not.toMatch(/(?:^|;)mask-image:/)
    expect(css).not.toMatch(/(?:^|;)-webkit-mask-image:/)
  })

  it('puts PlayButton JOUER centering in the stylesheet instead of losing it to flex-start defaults', () => {
    const label: VisualTreeNode = {
      binding: 'playButton_label',
      style: {
        position: 'absolute',
        width: { value: 100, unit: '%' },
        height: { value: 100, unit: '%' },
        'unity-text-align': 'middle-center',
        'font-size': { value: 36, unit: 'px' },
      },
      ancestor_states: [{
        state: 'disabled',
        depth: 2,
        style: {
          position: 'absolute',
          'unity-text-align': 'middle-center',
          opacity: 0.6,
        },
      }],
    }
    const { inlineUss, cssUss } = splitCascade(label)
    expect(cssUss['unity-text-align']).toBe('middle-center')
    expect(inlineUss['unity-text-align']).toBeUndefined()
    const css = nodeCascadeCss('playButton_label', label, ['container', 'btn_play'])
    expect(css).toContain('justify-content:center')
    expect(css).toContain('align-items:center')
  })

  it('treats a Slot with hover as a pointer target', () => {
    expect(hasPointerState(button)).toBe(true)
    expect(hasPointerState(tile)).toBe(false)
    expect(stateSelectors('[data-official-id="x"]', 'focus+hover')).toEqual([
      '[data-official-id="x"]:focus-within:hover',
      '[data-official-id="x"][data-state="focus+hover"]',
    ])
    expect(stateSelectors('[data-official-id="card"]', 'hover+selected')).toEqual([
      '[data-official-id="card"]:hover[data-state="selected"]',
      '[data-official-id="card"][data-state="hover+selected"]',
    ])
  })

  it('emits the official selected sprite from an ancestor data-state', () => {
    const card: VisualTreeNode = {
      binding: 'serverCard',
      style: { 'background-image': 'styles/images/containCardServerDefault.png' },
      ancestor_states: [
        {
          state: 'selected',
          depth: 1,
          style: { 'background-image': 'styles/images/containCardServerActive.png' },
        },
        {
          state: 'hover+selected',
          depth: 1,
          style: { 'background-image': 'styles/images/containCardServerActiveHover.png' },
        },
      ],
    }
    const css = nodeCascadeCss('serverCard', card, ['ctr_serverCard'])
    expect(css).toContain('[data-official-id="ctr_serverCard"][data-state="selected"] [data-official-id="serverCard"]')
    expect(css).toContain('containCardServerActive.png')
    expect(css).toContain('[data-official-id="ctr_serverCard"]:hover[data-state="selected"]')
    expect(css).toContain('containCardServerActiveHover.png')
  })

  it('handles self_state on ancestor_states (e.g. .window:hover #label:disabled)', () => {
    const label: VisualTreeNode = {
      binding: 'btn_label',
      style: { color: '#ffffff' },
      ancestor_states: [
        {
          state: 'hover',
          depth: 1,
          self_state: 'disabled',
          style: { color: '#666666' },
        },
      ],
    }
    const css = nodeCascadeCss('btn_label', label, ['btn_container'])
    expect(css).toContain('[data-official-id="btn_container"]:hover [data-official-id="btn_label"][data-disabled="true"]')
    expect(css).toContain('color:#666666')
  })

  it('handles requires on ancestor_states for multi-ancestor conditions', () => {
    const icon: VisualTreeNode = {
      binding: 'sub_icon',
      style: { opacity: 0.8 },
      ancestor_states: [
        {
          state: 'pressed',
          depth: 1,
          requires: [{ depth: 2, state: 'hover' }],
          style: { opacity: 0.3 },
        },
      ],
    }
    const css = nodeCascadeCss('sub_icon', icon, ['window', 'btn'])
    expect(css).toContain('[data-official-id="window"]:hover [data-official-id="btn"]:active [data-official-id="sub_icon"]')
    expect(css).toContain('opacity:0.3')
  })
})

