export type GinyFrame = { messageId: number; payload: Uint8Array }

export function packClientFrame(messageId: number, instanceId: number, payload: Uint8Array): Uint8Array {
  if (!Number.isInteger(messageId) || messageId < 0 || messageId > 16383) throw new RangeError('Message ID exceeds the 14-bit protocol header.')
  if (payload.length > 0xffffff) throw new RangeError('Payload exceeds the 24-bit protocol length.')
  const size = payload.length
  const lengthType = size > 65535 ? 3 : size > 255 ? 2 : size > 0 ? 1 : 0
  const result = new Uint8Array(2 + 4 + lengthType + size)
  const view = new DataView(result.buffer)
  view.setUint16(0, (messageId << 2) | lengthType, false)
  view.setUint32(2, instanceId >>> 0, false)
  let offset = 6
  if (lengthType === 1) result[offset++] = size
  if (lengthType === 2) { view.setUint16(offset, size, false); offset += 2 }
  if (lengthType === 3) {
    result[offset++] = (size >>> 16) & 0xff
    view.setUint16(offset, size & 0xffff, false)
    offset += 2
  }
  result.set(payload, offset)
  return result
}

export class ServerFrameCodec {
  private buffer = new Uint8Array()

  push(chunk: Uint8Array): GinyFrame[] {
    const merged = new Uint8Array(this.buffer.length + chunk.length)
    merged.set(this.buffer)
    merged.set(chunk, this.buffer.length)
    this.buffer = merged
    const frames: GinyFrame[] = []
    let offset = 0
    while (this.buffer.length - offset >= 2) {
      const header = (this.buffer[offset] << 8) | this.buffer[offset + 1]
      const messageId = header >>> 2
      const lengthType = header & 3
      if (this.buffer.length - offset < 2 + lengthType) break
      let size = 0
      if (lengthType === 1) size = this.buffer[offset + 2]
      if (lengthType === 2) size = (this.buffer[offset + 2] << 8) | this.buffer[offset + 3]
      if (lengthType === 3) size = (this.buffer[offset + 2] << 16) | (this.buffer[offset + 3] << 8) | this.buffer[offset + 4]
      const payloadOffset = offset + 2 + lengthType
      if (this.buffer.length - payloadOffset < size) break
      frames.push({ messageId, payload: this.buffer.slice(payloadOffset, payloadOffset + size) })
      offset = payloadOffset + size
    }
    if (offset > 0) this.buffer = this.buffer.slice(offset)
    return frames
  }

  reset(): void { this.buffer = new Uint8Array() }
}
