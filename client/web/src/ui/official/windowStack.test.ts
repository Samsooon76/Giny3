import { expect, it } from 'vitest'
import { layoutStore, windowStackStore } from './layoutStore'

it('raises opened, clicked and reopened windows without changing saved geometry', () => {
  const geometry = { x: 30, y: 40, w: 500, h: 600, docked: [], z: 900 }
  layoutStore.set('stack-test-inventory', geometry)
  windowStackStore.raise('stack-test-chat')
  windowStackStore.raise('stack-test-inventory')
  expect(windowStackStore.snapshot()['stack-test-inventory']).toBeGreaterThan(windowStackStore.snapshot()['stack-test-chat'])
  windowStackStore.raise('stack-test-chat')
  expect(windowStackStore.snapshot()['stack-test-chat']).toBeGreaterThan(windowStackStore.snapshot()['stack-test-inventory'])
  windowStackStore.raise('stack-test-inventory')
  expect(windowStackStore.snapshot()['stack-test-inventory']).toBeGreaterThan(windowStackStore.snapshot()['stack-test-chat'])
  expect(layoutStore.get('stack-test-inventory')).toEqual(geometry)
  layoutStore.reset('stack-test-inventory')
})
