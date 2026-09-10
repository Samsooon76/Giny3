import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OFFICIAL_CANVAS } from './surface'

describe('official reference frame', () => {
  it('keeps the TypeScript canvas aligned with reference_frame.json', () => {
    const frame = JSON.parse(readFileSync(resolve(process.cwd(), '../dofus3/reference_frame.json'), 'utf8'))
    expect(OFFICIAL_CANVAS).toEqual({ width: frame.layout_points[0], height: frame.layout_points[1] })
  })
})
