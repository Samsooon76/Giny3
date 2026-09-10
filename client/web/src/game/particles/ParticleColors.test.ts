import { expect, it } from 'vitest'
import { ParticleColors, rotate, vector } from './parameters'
import cases from './color-regression.json'
it('matches captured pre-pooling colors while reusing output storage across every gradient mode', () => {
  const colors = new ParticleColors()
  const reference = colors.sample(undefined, 0, 0)
  for (const fixture of cases) {
    const actual = colors.sample(fixture.parameters, fixture.t, fixture.random)
    expect(actual).toBe(reference)
    for (let i = 0; i < 4; i++) expect(actual[i]).toBeCloseTo(fixture.expected[i], 12)
  }
})
it('supports reusable vector and in-place rotation outputs', () => {
  const target = { x: 0, y: 0, z: 0 }
  expect(vector({ x: 2, y: 3, z: 4 }, 0, target)).toBe(target)
  const expected = rotate(2, 3, 4, { x: 45, y: -17, z: 31 })
  expect(rotate(target.x, target.y, target.z, { x: 45, y: -17, z: 31 }, target)).toBe(target)
  expect(target).toEqual(expected)
})
