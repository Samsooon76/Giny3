import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { decodeBC7 } from './bc7'
const sample = () => Uint8Array.from(readFileSync(new URL('./fixtures/4x4.ktx2', import.meta.url))).buffer
it('decodes an actual BC7/Zstd texture emitted by our offline encoder', () => {
  const decoded = decodeBC7(sample())
  expect([decoded.width, decoded.height, decoded.blocks.length]).toEqual([4, 4, 16])
})
it('rejects truncated payloads and inconsistent decoded sizes before allocation', () => {
  expect(() => decodeBC7(sample().slice(0, 145))).toThrow()
  const bytes = sample(); new DataView(bytes).setBigUint64(96, 1000000000n, true)
  expect(() => decodeBC7(bytes)).toThrow('tronqué')
})
it('rejects straight-alpha and unsupported compressed formats', () => {
  const bytes = sample(); new DataView(bytes).setUint8(119, 0)
  expect(() => decodeBC7(bytes)).toThrow('prémultipliées')
  const different = sample(); new DataView(different).setUint32(12, 146, true)
  expect(() => decodeBC7(different)).toThrow('non pris en charge')
})
