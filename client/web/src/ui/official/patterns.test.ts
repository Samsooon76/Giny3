import { describe, expect, it } from 'vitest'
import type { VisualTreeNode } from './types'
import { findGiny, ginyPrimitive, ginySize, layoutFacts, nineSlice, normalizeGiny } from './patterns'

const inventoryLike: VisualTreeNode = {
  type: 'UXML',
  name: 'equipmentUi',
  asset: 'equipmentStorageUi',
  full_type: 'UnityEngine.UIElements.UXML',
  children: [
    {
      type: 'WindowFigma',
      name: 'PlayerInventory',
      binding: 'PlayerInventory',
      full_type: 'Core.UILogic.Components.Figma.WindowFigma',
      classes: ['window'],
      style: { width: { value: 980, unit: 'px' }, height: { value: 880, unit: 'px' }, position: 'absolute' },
      children: [
        { type: 'VisualElement', name: 'window_background', style: { 'unity-slice-left': { value: 12, unit: 'px' }, 'unity-slice-bottom': { value: 12, unit: 'px' }, 'unity-slice-right': { value: 12, unit: 'px' }, 'unity-slice-top': { value: 12, unit: 'px' }, 'background-image': 'styles/images/window.png' } },
        { type: 'VisualElement', name: 'window_shadow' },
        { type: 'VisualElement', name: 'window_inner' },
        {
          type: 'VisualElement',
          name: 'window_content',
          children: [
            { type: 'DofusLabel', name: 'lbl_title', text: 'Inventaire' },
            {
              type: 'StorageSlotGrid',
              name: 'grid',
              binding: 'grid',
              children: [
                {
                  type: 'VisualElement',
                  name: 'grid_cell_0',
                  children: [{
                    type: 'VisualElement',
                    name: 'grid_background_0',
                    children: [{
                      type: 'Slot',
                      name: 'slot_0',
                      binding: 'slot_0',
                      children: [{
                        type: 'VisualElement',
                        name: 'itemTile_container',
                        children: [{ type: 'VisualElement', name: 'itemTile_icon', sprite: 'icons/helmet.png' }],
                      }],
                    }],
                  }],
                },
                {
                  type: 'VisualElement',
                  name: 'grid_cell_1',
                  children: [{
                    type: 'VisualElement',
                    name: 'grid_background_1',
                    children: [{ type: 'Slot', name: 'slot_1', binding: 'slot_1', children: [{ type: 'VisualElement', name: 'itemTile_container' }] }],
                  }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

describe('giny primitives', () => {
  it('maps UITK components, not uGUI RectTransforms', () => {
    expect(ginyPrimitive({ type: 'WindowFigma' })).toBe('Window')
    expect(ginyPrimitive({ type: 'MagneticDragWindow' })).toBe('Window')
    expect(ginyPrimitive({ type: 'StorageSlotGrid' })).toBe('ItemGrid')
    expect(ginyPrimitive({ type: 'Slot' })).toBe('ItemSlot')
    expect(ginyPrimitive({ type: 'PlayButton' })).toBe('Button')
    expect(ginyPrimitive({ type: 'ScrollView' })).toBe('ScrollView')
    expect(ginyPrimitive({ type: 'TextInput' })).toBe('TextInput')
    expect(ginyPrimitive({ type: 'DofusLabel' })).toBe('Text')
    expect(ginyPrimitive({ type: 'VisualElement', name: 'header' })).toBe('Header')
    expect(ginyPrimitive({ type: 'VisualElement', style: { 'flex-direction': 'row' } })).toBe('FlexRow')
    expect(ginyPrimitive({
      type: 'VisualElement',
      style: { 'unity-slice-left': { value: 8, unit: 'px' }, 'unity-slice-top': { value: 8, unit: 'px' } },
    })).toBe('NineSlice')
  })

  it('keeps USS layout facts instead of resolving them to left/top pixels', () => {
    const layout = layoutFacts({
      position: 'absolute',
      left: { value: 20, unit: 'px' },
      width: '100%',
      'flex-direction': 'column',
      color: '#fff',
    })
    expect(layout).toEqual({
      position: 'absolute',
      left: { value: 20, unit: 'px' },
      width: '100%',
      'flex-direction': 'column',
    })
    expect(nineSlice({
      'unity-slice-left': { value: 12, unit: 'px' },
      'unity-slice-bottom': 4,
      'unity-slice-right': { value: 12, unit: 'px' },
      'unity-slice-top': { value: 6, unit: 'px' },
    })).toEqual([12, 4, 12, 6])
  })
})

describe('normalizeGiny', () => {
  it('recognises a Window + ItemGrid and drops UITK chrome / tile interiors', () => {
    const ast = normalizeGiny(inventoryLike)
    const windows = findGiny(ast, 'Window')
    expect(windows).toHaveLength(1)
    expect(windows[0].name).toBe('PlayerInventory')
    expect(windows[0].layout.width).toEqual({ value: 980, unit: 'px' })
    expect(windows[0].visual?.nineSlice).toEqual([12, 12, 12, 12])
    expect(windows[0].visual?.sprite).toBe('styles/images/window.png')
    expect(windows[0].children.map((child) => child.component)).toEqual(['Text', 'ItemGrid'])
    expect(windows[0].children.some((child) => child.name === 'window_background')).toBe(false)

    const grids = findGiny(ast, 'ItemGrid')
    expect(grids).toHaveLength(1)
    expect(grids[0].children).toHaveLength(2)
    expect(grids[0].children.every((child) => child.component === 'ItemSlot')).toBe(true)
    expect(grids[0].children[0].source.sprite).toBe('icons/helmet.png')
    expect(grids[0].children[0].children).toEqual([])
    expect(grids[0].children.some((child) => child.name === 'grid_cell_0')).toBe(false)

    expect(ginySize(ast)).toBeLessThan(8)
  })
})
