import { expect, it } from 'vitest'
import { parseEntityLook } from './look'
import { normalizeLegacyPlayerScale } from './legacyScale'

it('renders the existing 2.68 character at its Dofus 3 breed scale', () => {
  const look = parseEntityLook('{1|10,2012|1=31824744,2=41369385|135}')!
  const normalized = normalizeLegacyPlayerScale(look)!
  expect(normalized.scale).toBe(.53)
  expect(normalized.skinIds).toEqual(look.skinIds)
  expect(normalized.colors).toEqual(look.colors)
  expect(normalized.raw).toBe(look.raw)
  expect(look.scale).toBe(1.35)
  expect(normalizeLegacyPlayerScale(normalized)).toBe(normalized)
})

it('preserves official scales, custom sizes, props and transformed appearances', () => {
  for (const raw of ['{1|10,2012||53}', '{1|10||80}', '{563|||105}', '{2|10||135}', '{1|999||135}', '{1|10|||}', '{1|10||135,100}']) {
    const look = parseEntityLook(raw)
    expect(normalizeLegacyPlayerScale(look)).toBe(look)
  }
})

it('supports the female and non-decimal base-skin identifiers from the legacy catalogue', () => {
  expect(normalizeLegacyPlayerScale(parseEntityLook('{1|11,2012||125}'))?.scale).toBe(.52)
  expect(normalizeLegacyPlayerScale(parseEntityLook('{1|1405,2000||160}'))?.scale).toBe(.58)
})
