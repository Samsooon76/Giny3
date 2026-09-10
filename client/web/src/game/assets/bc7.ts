import { decompress } from 'fzstd'
const MAGIC = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 13, 10, 26, 10]
/** Strict subset produced by prepare-assets: 2D BC7 UNORM, one mip, PMA. */
export function decodeBC7(buffer: ArrayBuffer): { width: number; height: number; blocks: Uint8Array } {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  if (bytes.length < 148 || MAGIC.some((n, i) => bytes[i] !== n)) throw new Error('KTX2 invalide')
  const width = view.getUint32(20, true), height = view.getUint32(24, true)
  if (view.getUint32(12, true) !== 145 || view.getUint32(16, true) !== 1 ||
    !width || !height || width > 4096 || height > 4096 || width % 4 || height % 4 ||
    view.getUint32(28, true) || view.getUint32(32, true) || view.getUint32(36, true) !== 1 ||
    view.getUint32(40, true) !== 1 || view.getUint32(44, true) !== 2) throw new Error('Profil KTX2 BC7 non pris en charge')
  const dfd = view.getUint32(48, true)
  if (dfd < 104 || dfd + 44 > bytes.length || bytes[dfd + 15] !== 1) throw new Error('KTX2 doit contenir des couleurs prémultipliées')
  const offset = Number(view.getBigUint64(80, true)), size = Number(view.getBigUint64(88, true))
  const expected = width * height
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || size <= 0 || offset < dfd + 44 ||
    offset + size > bytes.length || view.getBigUint64(96, true) !== BigInt(expected)) throw new Error('Niveau KTX2 tronqué')
  const blocks = decompress(bytes.subarray(offset, offset + size), new Uint8Array(expected))
  if (blocks.length !== expected) throw new Error('Taille BC7 incorrecte')
  return { width, height, blocks }
}
