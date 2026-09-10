export class Writer {
  private bytes: number[] = []
  u8(value: number): this { this.bytes.push(value & 0xff); return this }
  u16(value: number): this { return this.u8(value >>> 8).u8(value) }
  i16(value: number): this { return this.u16(value) }
  i32(value: number): this {
    return this.u8(value >>> 24).u8(value >>> 16).u8(value >>> 8).u8(value)
  }
  f64(value: number): this {
    const buffer = new ArrayBuffer(8)
    new DataView(buffer).setFloat64(0, value, false)
    return this.raw(new Uint8Array(buffer))
  }
  utf(value: string): this {
    const encoded = new TextEncoder().encode(value)
    return this.u16(encoded.length).raw(encoded)
  }
  varUInt(value: number): this {
    let remaining = Math.max(0, Math.trunc(value))
    while (remaining >= 0x80) {
      this.u8((remaining & 0x7f) | 0x80)
      remaining = Math.floor(remaining / 128)
    }
    return this.u8(remaining)
  }
  raw(value: Uint8Array): this { this.bytes.push(...value); return this }
  finish(): Uint8Array { return Uint8Array.from(this.bytes) }
}

export class Reader {
  offset = 0
  readonly bytes: Uint8Array
  constructor(bytes: Uint8Array) { this.bytes = bytes }
  u8(): number { return this.bytes[this.offset++] ?? 0 }
  u16(): number { return (this.u8() << 8) | this.u8() }
  i16(): number { const value = this.u16(); return value >= 0x8000 ? value - 0x10000 : value }
  i32(): number {
    const value = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.offset, 4).getInt32(0, false)
    this.offset += 4
    return value
  }
  f64(): number {
    const value = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.offset, 8).getFloat64(0, false)
    this.offset += 8
    return value
  }
  utf(): string {
    const length = this.u16()
    const value = new TextDecoder().decode(this.bytes.subarray(this.offset, this.offset + length))
    this.offset += length
    return value
  }
  varUInt(): number {
    let result = 0
    let multiplier = 1
    for (let index = 0; index < 10; index += 1) {
      const value = this.u8()
      result += (value & 0x7f) * multiplier
      if ((value & 0x80) === 0) return result
      multiplier *= 128
    }
    throw new Error('VarUInt Giny invalide.')
  }
  raw(length: number): Uint8Array {
    const value = this.bytes.slice(this.offset, this.offset + length)
    this.offset += length
    return value
  }
}
