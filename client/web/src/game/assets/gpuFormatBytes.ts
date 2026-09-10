const sized: Record<number, number> = {
  0x8229: 1, 0x822b: 2, 0x8051: 3, 0x8058: 4, 0x8c41: 3, 0x8c43: 4,
  0x822d: 2, 0x822e: 4, 0x822f: 4, 0x8230: 8, 0x881b: 6, 0x8815: 12, 0x881a: 8, 0x8814: 16,
  0x8231: 1, 0x8232: 1, 0x8233: 2, 0x8234: 2, 0x8235: 4, 0x8236: 4,
  0x8237: 2, 0x8238: 2, 0x8239: 4, 0x823a: 4, 0x823b: 8, 0x823c: 8,
  0x8d8e: 4, 0x8d7c: 4, 0x8d88: 8, 0x8d76: 8, 0x8d82: 16, 0x8d70: 16,
  0x8056: 2, 0x8057: 2, 0x8d62: 2, 0x8059: 4, 0x8c3a: 4, 0x8c3d: 4,
  0x84f9: 4, 0x81a7: 4, 0x81a5: 2, 0x81a6: 3, 0x8cac: 4, 0x88f0: 4, 0x8cad: 8, 0x8d48: 1,
}
const components: Record<number, number> = { 0x1903: 1, 0x1906: 1, 0x1909: 1, 0x190a: 2, 0x8227: 2, 0x1907: 3, 0x1908: 4, 0x1902: 1, 0x8d94: 1, 0x8228: 2, 0x8d98: 3, 0x8d99: 4 }
const scalars: Record<number, number> = { 0x1400: 1, 0x1401: 1, 0x1402: 2, 0x1403: 2, 0x1404: 4, 0x1405: 4, 0x1406: 4, 0x140b: 2, 0x8d61: 2 }
const packed: Record<number, number> = { 0x8033: 2, 0x8034: 2, 0x8363: 2, 0x8368: 4, 0x84fa: 4, 0x8c3b: 4, 0x8c3e: 4, 0x8dad: 8 }
const blockBytes: Record<number, number> = { 0x8e8c: 16, 0x8e8d: 16, 0x83f0: 8, 0x83f1: 8, 0x83f2: 16, 0x83f3: 16, 0x9274: 8, 0x9278: 16 }
/** Declared payload size; excludes driver alignment and implementation overhead. */
export function gpuImageBytes(internal: number, width: number, height: number, depth = 1, format?: number, type?: number): number | null {
  if (![width, height, depth].every(value => Number.isFinite(value) && value >= 0)) return null
  const block = blockBytes[internal]
  if (block) return Math.ceil(width / 4) * Math.ceil(height / 4) * depth * block
  const stride = sized[internal] ?? (type !== undefined ? packed[type] ?? (components[format ?? internal] ?? NaN) * (scalars[type] ?? NaN) : NaN)
  return Number.isFinite(stride) ? width * height * depth * stride : null
}
