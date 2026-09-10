import { expect, it } from 'vitest'
import { AnimationPlayer } from './AnimationPlayer'
import type { WebEntityData } from './types'

function player(frames = 4, loop = true) {
  const p = new AnimationPlayer()
  p.setup({ animations: { clip: { frameRate: 10, frames: Array.from({ length: frames }, () => []) } } } as unknown as WebEntityData)
  p.play('clip', loop)
  return p
}
it('advances at the clip rate and skips redraws between frames', () => {
  const p = player()
  expect(p.tick(.03)).toBe(false)
  expect(p.tick(.08)).toBe(true)
  expect(p.frameIndex).toBe(1)
})
it('catches up in constant time and avoids repainting the same loop frame', () => {
  const p = player()
  expect(p.tick(400_000)).toBe(false)
  expect(p.frameIndex).toBe(0)
  expect(p.playing).toBe(true)
})
it('ends one-frame transitions after their duration', () => {
  const p = player(1, false)
  expect(p.tick(.1)).toBe(false)
  expect(p.playing).toBe(false)
})
it('holds the last frame after a one-shot, including a long stall', () => {
  const p = player(4, false)
  expect(p.tick(100)).toBe(true)
  expect(p.frameIndex).toBe(3)
  expect(p.playing).toBe(false)
  expect(p.tick(1)).toBe(false)
})
it('ignores invalid deltas without poisoning subsequent frames', () => {
  const p = player()
  for (const dt of [NaN, Infinity, -1]) expect(p.tick(dt)).toBe(false)
  p.tick(.1)
  expect(p.frameIndex).toBe(1)
})
