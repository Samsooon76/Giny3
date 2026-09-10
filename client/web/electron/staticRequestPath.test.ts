import { describe, expect, it } from 'vitest'
import { staticRequestPath } from './staticRequestPath.mjs'
describe('Electron static assets', () => {
  it.each(['dofus3/fight/digits/blue/2.png', 'dofus3/fight/digits/green/minus.png', 'combat-assets/1.webp', 'assets/index.js', 'bubble/runtime/x-D8TUb0j1.js', 'bubble/runtime/map3_actor_batcher-DlTqz3p7.wasm'])('resolves worker and renderer forms of %s equally', path => {
    expect(staticRequestPath(new URL(`app://${path}`))).toBe(path)
    expect(staticRequestPath(new URL(`app://-/${path}`))).toBe(path)
  })
  it('rejects unrecognized hosts', () => expect(staticRequestPath(new URL('app://unknown/fight/x.png'))).toBeNull())
})
