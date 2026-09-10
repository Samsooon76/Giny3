import { Reader } from './binary'

/** The 0xffff marker is reserved on modern projection messages only. */
export function readModernJson(payload: Uint8Array): string {
  if (payload.length < 2) throw new Error('Projection JSON tronquée.')
  const reader = new Reader(payload)
  let length = reader.u16()
  if (length === 0xffff) length = reader.i32()
  if (length < 0 || length > 4 * 1024 * 1024 || reader.offset + length !== payload.length)
    throw new Error('Longueur de projection JSON invalide.')
  return new TextDecoder('utf-8', { fatal: true }).decode(reader.raw(length))
}
