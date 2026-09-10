import { describe, expect, it } from 'vitest'
import { hydrateCatalog } from '../../ui/game/catalog'
import {
  getSpellScript,
  hydrateSpellScripts,
  parseScriptAnimId,
  resetSpellScripts,
  resolveAttackAnimKinds,
} from './spellScripts'

describe('spellScripts', () => {
  it('resolves a bound Dofus 3 JSON cast clip before generic fallbacks', () => {
    hydrateCatalog({ spells: { '12978': { id: 12978, boundScriptUsageData: [{ scriptId: 16441 }] } } })
    hydrateSpellScripts({ '16441': { type: 9, rawParams: '{"main":{"sequences":[{"gfxs":[{"type":"cast","casterAnimation":"AnimAttaque115"}]}]}}' } })
    expect(resolveAttackAnimKinds({ spell_id: 12978 }, 1)[0]).toBe('AnimAttaque115')
  })
  it('parses animId from script rawParams', () => {
    expect(parseScriptAnimId('animId:1')).toBe(1)
    expect(parseScriptAnimId('animId:4,targetGfxId:1592')).toBe(4)
    expect(parseScriptAnimId('')).toBeUndefined()
    expect(parseScriptAnimId('noAnimHere')).toBeUndefined()
  })

  it('hydrates and resolves spellscript metadata', () => {
    resetSpellScripts()
    hydrateSpellScripts({
      '17874': { type: 1, rawParams: 'animId:1' },
      '17875': { type: 1, rawParams: 'animId:2' },
    })

    expect(getSpellScript(17874)).toEqual({ type: 1, rawParams: 'animId:1' })
    expect(getSpellScript(99999)).toBeUndefined()
  })

  it('resolves attack anim kinds for character cast against BoneIndex', () => {
    hydrateSpellScripts({
      '17874': { type: 1, rawParams: 'animId:1' },
    })

    // Mock BoneIndex for bone 1 class 1 (Feca)
    const boneIndexBone1Class1 = {
      AnimAttaque100: '1-1-combat',
      AnimAttaque101: '1-1-combat',
      AnimAttaque102: '1-1-combat',
      AnimHit: '1-combat',
    }

    const kinds = resolveAttackAnimKinds({ script_id: 17874, spell_id: 12983 }, 1)
    expect(kinds[0]).toBe('AnimAttaque101')

    // Find the first matched anim in the BoneIndex
    const matched = kinds.find((k) => k in boneIndexBone1Class1)
    expect(matched).toBe('AnimAttaque101')
  })

  it('resolves weapon attack anim against BoneIndex', () => {
    const boneIndexBone1Class1 = {
      AnimAttaque100: '1-1-combat',
      AnimAttaque101: '1-1-combat',
      AnimHit: '1-combat',
    }

    const kinds = resolveAttackAnimKinds({ type: 'weapon' }, 1)
    expect(kinds).toContain('AnimAttaque100')
    const matched = kinds.find((k) => k in boneIndexBone1Class1)
    expect(matched).toBe('AnimAttaque100')
  })
})
