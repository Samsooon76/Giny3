import { describe, expect, it } from 'vitest'
import { isLocalRequest } from './localOnly.mjs'

describe('isLocalRequest', () => {
  it('accepts the app:// mounts the extracted data is served from', () => {
    expect(isLocalRequest('app://-/index.html')).toBe(true)
    expect(isLocalRequest('app://game-data/maps/154644.json')).toBe(true)
    expect(isLocalRequest('app://game-data/gfx/7945.png')).toBe(true)
    expect(isLocalRequest('app://ui-data/fonts/Lexend-Regular.ttf')).toBe(true)
    expect(isLocalRequest('app://uitk/assets/bannerMenu.png')).toBe(true)
  })

  it('accepts the local schemes Pixi and the devtools rely on', () => {
    expect(isLocalRequest('blob:app://-/8f1a')).toBe(true)
    expect(isLocalRequest('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    expect(isLocalRequest('devtools://devtools/bundled/inspector.html')).toBe(true)
  })

  it('rejects remote asset hosts, which is what a download would look like', () => {
    expect(isLocalRequest('https://dofusdb.fr/img/maps/154644.png')).toBe(false)
    expect(isLocalRequest('https://static.ankama.com/dofus/gfx/7945.png')).toBe(false)
    expect(isLocalRequest('http://cdn.example.com/entities/look_1_10_2012.json')).toBe(false)
    expect(isLocalRequest('wss://example.com/socket')).toBe(false)
    expect(isLocalRequest('not a url')).toBe(false)
  })

  it('only trusts loopback while the dev server serves the renderer', () => {
    expect(isLocalRequest('http://localhost:5173/src/main.tsx')).toBe(false)
    expect(isLocalRequest('http://localhost:5173/src/main.tsx', { allowLoopback: true })).toBe(true)
    expect(isLocalRequest('http://127.0.0.1:5173/game-data/maps/0.json', { allowLoopback: true })).toBe(true)
    expect(isLocalRequest('ws://127.0.0.1:5173/giny', { allowLoopback: true })).toBe(true)
    // Loopback in dev is the app itself, never a licence for a remote host.
    expect(isLocalRequest('https://static.ankama.com/gfx/1.png', { allowLoopback: true })).toBe(false)
  })
})
