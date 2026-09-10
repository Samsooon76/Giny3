import { Readable } from 'node:stream'
import { open } from 'node:fs/promises'

/** A single RFC 9110 byte range; multipart requests are intentionally rejected. */
export function byteRange(value, size) {
  if (!value) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(value)
  if (!match || (!match[1] && !match[2]) || !size) return false
  const a = match[1] ? Number(match[1]) : null,
    b = match[2] ? Number(match[2]) : null
  if (
    (a !== null && !Number.isSafeInteger(a)) ||
    (b !== null && !Number.isSafeInteger(b))
  )
    return false
  if (a === null)
    return b > 0 ? { start: Math.max(0, size - b), end: size - 1 } : false
  if (a >= size || (b !== null && b < a)) return false
  return { start: a, end: Math.min(b ?? size - 1, size - 1) }
}

/** Owns its descriptor until consumption/cancellation of the response body. */
export async function fileResponse(filename, request, headers = {}) {
  const file = await open(filename, 'r')
  try {
    const { size } = await file.stat()
    const range = byteRange(request.headers.get('range'), size)
    headers = { ...headers, 'Accept-Ranges': 'bytes' }
    if (range === false) {
      await file.close()
      return new Response(null, {
        status: 416,
        headers: { ...headers, 'Content-Range': `bytes */${size}` },
      })
    }
    const status = range ? 206 : 200
    headers['Content-Length'] = String(
      range ? range.end - range.start + 1 : size,
    )
    if (range)
      headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`
    if (request.method === 'HEAD') {
      await file.close()
      return new Response(null, { status, headers })
    }
    if (request.signal.aborted) {
      await file.close()
      throw request.signal.reason
    }
    const stream = file.createReadStream(range ?? {})
    const abort = () => stream.destroy()
    request.signal.addEventListener('abort', abort, { once: true })
    stream.once('close', () =>
      request.signal.removeEventListener('abort', abort),
    )
    return new Response(Readable.toWeb(stream), { status, headers })
  } catch (error) {
    await file.close().catch(() => {})
    throw error
  }
}
