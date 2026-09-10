import { expect, it } from 'vitest'
import { dividerInterior } from './divider'
import type { VisualTreeNode } from './types'

it('restores the ornament holder and hides only an empty divider caption', () => {
  const node: VisualTreeNode = { type: 'Divider', children: [{ binding: 'divider_dividerContainer', children: [
    { binding: 'divider_lineLeft' },
    { binding: 'divider_diamond', children: [{ binding: 'divider_diamondContainer' }] },
    { binding: 'divider_lineRight' }, { binding: 'divider_text' },
  ] }] }
  const children = dividerInterior(node)![0].children!
  expect(children[1].binding).toBe('divider_diamondContainer')
  expect(children[1].children![0].binding).toBe('divider_diamond')
  expect(children[1].style?.height).toBe(4)
  expect(children[3].style?.display).toBe('none')
  expect(dividerInterior(node, 'Section')![0].children![3].style?.display).not.toBe('none')
  expect(node.children![0].children![1].binding).toBe('divider_diamond')
})
