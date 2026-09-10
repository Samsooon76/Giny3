import { expect, it } from 'vitest'
import { Writer } from './binary'
import { readModernJson } from './modernJson'

it('lit les petites projections du protocole historique', () => {
  expect(readModernJson(new Writer().utf('{"nom":"Épée"}').finish())).toBe('{"nom":"Épée"}')
})
it('lit une projection dépassant 64 Kio sans tronquer les caractères UTF-8', () => {
  const json = JSON.stringify({ name: 'Épée'.repeat(20000) })
  const bytes = new TextEncoder().encode(json)
  const payload = new Uint8Array(6 + bytes.length)
  const view = new DataView(payload.buffer)
  view.setUint16(0, 0xffff)
  view.setInt32(2, bytes.length)
  payload.set(bytes, 6)
  expect(readModernJson(payload)).toBe(json)
  expect(() => readModernJson(payload.slice(0, -1))).toThrow()
})
it('refuse les longueurs négatives, excessives et le JSON tronqué', () => {
  for (const length of [-1, 4 * 1024 * 1024 + 1]) expect(() => readModernJson(new Writer().u16(0xffff).i32(length).finish())).toThrow()
  expect(() => readModernJson(new Uint8Array([0, 3, 123]))).toThrow()
})
