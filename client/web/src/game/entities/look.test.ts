import { describe, expect, it } from 'vitest'
import { entityDocumentCandidates, parseEntityLook } from './look'

describe('entityDocumentCandidates', () => {
  it('prefers a composed look file, then a bone base, then the raw bone', () => {
    expect(entityDocumentCandidates('{1|10,2012|1=#e59b68|53}')).toEqual([
      'entities/look_1_10_2012.json',
      'entities/look_1_base.json',
      'entities/1.json',
    ])
  })

  it('skips the composed look path when the actor has no skins', () => {
    expect(entityDocumentCandidates('{231|||}')).toEqual([
      'entities/look_231_base.json',
      'entities/231.json',
    ])
  })

  it('returns nothing for an unreadable look', () => {
    expect(entityDocumentCandidates('not-a-look')).toEqual([])
    expect(parseEntityLook('not-a-look')).toBeNull()
  })
})
