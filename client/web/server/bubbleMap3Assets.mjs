import fs from 'node:fs/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'
import {
  gunzipSync,
  brotliDecompressSync,
  createGunzip,
  createBrotliDecompress,
} from 'node:zlib'
import { createHash, randomUUID } from 'node:crypto'
import { fileResponse } from './fileResponse.mjs'

export const validBubbleKey = (key) =>
  typeof key === 'string' &&
  !key.includes('\0') &&
  !key.includes('\\') &&
  !key.split('/').some((p) => !p || p === '..' || p === '.') &&
  (key.startsWith('map3/') ||
    /^(b|s|gfx)\/[0-9]+\//.test(key) ||
    key === 'manifest.json')

/** Shared by Vite and Electron. At most four preparations, one per asset key.
 * Large carriers are streamed to disk, hash checked, then atomically published.
 * No Bubble application/account state is exposed by this resolver.
 */
export function createBubbleAssets(
  root,
  {
    output = path.join(root, 'client/web/public/bubble/data'),
    prepared = [],
  } = {},
) {
  const cache = path.join(root, 'bubble/BubbleGame'),
    pending = new Map(),
    queue = [],
    verifiedSources = new Map()
  let indexPromise,
    active = 0
  const acquire = async () => {
    if (active >= 4) await new Promise((resolve) => queue.push(resolve))
    else active++
  }
  const release = () => {
    const next = queue.shift()
    if (next) next()
    else active--
  }
  async function index() {
    const entries = new Map()
    for await (const name of fs.glob('sources/*/manifests/*/objects/*.json', {
      cwd: cache,
    })) {
      let bytes = await fs.readFile(path.join(cache, name))
      if (bytes[0] === 31 && bytes[1] === 139) bytes = gunzipSync(bytes)
      let doc
      try {
        doc = JSON.parse(bytes.toString())
      } catch {
        doc = JSON.parse(brotliDecompressSync(bytes).toString())
      }
      for (const [key, entry] of Object.entries(doc.assets ?? {}))
        if (validBubbleKey(key)) entries.set(key, entry)
    }
    return entries
  }
  async function existing(key) {
    const verified = verifiedSources.get(key)
    if (verified) {
      try {
        const stat = await fs.stat(verified.file)
        if (stat.size === verified.size && stat.mtimeMs === verified.mtimeMs)
          return verified.file
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
      verifiedSources.delete(key)
    }
    for (const directory of [output, ...prepared]) {
      const file = path.join(directory, key)
      try {
        if ((await fs.stat(file)).isFile()) return file
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
  }
  async function prepare(key) {
    await acquire()
    const destination = path.join(output, key),
      temporary = `${destination}.${randomUUID()}.tmp`,
      encoded = `${temporary}.encoded`
    try {
      const hit = await existing(key)
      if (hit) return hit
      const entries = await (indexPromise ??= index().catch((error) => {
        indexPromise = undefined
        throw error
      }))
      const stored = entries.has(key)
        ? key
        : entries.has(key + '.br')
          ? key + '.br'
          : key + '.gz'
      const entry = entries.get(stored)
      if (!entry) return null
      if (!/^[a-f0-9]{64}$/.test(entry.hash))
        throw new Error('Invalid asset hash')
      if (
        key.startsWith('map3/packs/') &&
        !key.slice('map3/packs/'.length).includes('/')
      ) {
        const original = path.join(
          root,
          'client/web/runtime-assets/bubble-source-packs',
          key.slice('map3/packs/'.length),
        )
        try {
          const stat = await fs.stat(original),
            hash = createHash('sha256')
          for await (const chunk of createReadStream(original))
            hash.update(chunk)
          if (hash.digest('hex') !== entry.hash)
            throw new Error(`Invalid source pack hash: ${key}`)
          verifiedSources.set(key, {
            file: original,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
          })
          return original
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
        }
      }
      const carrier = entry.carrier
      let source
      if (carrier?.kind === 'pack') {
        if (
          !/^[a-f0-9]{64}$/.test(carrier.packHash) ||
          !Number.isSafeInteger(carrier.offset) ||
          carrier.offset < 0 ||
          !Number.isSafeInteger(carrier.length) ||
          carrier.length <= 0
        )
          throw new Error('Invalid carrier range')
        const pack = path.join(
          cache,
          `packs/sha256/${carrier.packHash.slice(0, 2)}/${carrier.packHash}.pack`,
        )
        try {
          const stat = await fs.stat(pack)
          if (carrier.offset + carrier.length > stat.size)
            throw new Error('Truncated pack')
          source = createReadStream(pack, {
            start: carrier.offset,
            end: carrier.offset + carrier.length - 1,
          })
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
        }
      }
      if (!source) {
        const blob = path.join(
          cache,
          `blobs/sha256/${entry.hash.slice(0, 2)}/${entry.hash}`,
        )
        try {
          await fs.access(blob)
          source = createReadStream(blob)
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
        }
      }
      if (!source) {
        const response = await fetch(
          `https://bubble-cdn.net/assets/${stored}`,
          { signal: AbortSignal.timeout(30000) },
        )
        if (!response.ok || !response.body) {
          await response.body?.cancel()
          throw new Error(
            `Bubble resource unavailable: ${stored} (${response.status})`,
          )
        }
        source = Readable.fromWeb(response.body)
      }
      await fs.mkdir(path.dirname(destination), { recursive: true })
      const hash = createHash('sha256')
      await pipeline(
        source,
        new Transform({
          transform(chunk, _encoding, callback) {
            hash.update(chunk)
            callback(null, chunk)
          },
        }),
        createWriteStream(encoded, { flags: 'wx' }),
      )
      if (hash.digest('hex') !== entry.hash)
        throw new Error(`Invalid asset hash: ${key}`)
      if (stored !== key)
        await pipeline(
          createReadStream(encoded),
          stored.endsWith('.gz') ? createGunzip() : createBrotliDecompress(),
          createWriteStream(temporary, { flags: 'wx' }),
        )
      else await fs.rename(encoded, temporary)
      await fs.rename(temporary, destination)
      return destination
    } finally {
      try {
        await Promise.all([
          fs.rm(temporary, { force: true }),
          fs.rm(encoded, { force: true }),
        ])
      } finally {
        release()
      }
    }
  }
  return {
    async resolve(key) {
      if (!validBubbleKey(key)) throw new Error('Invalid Bubble asset path')
      const hit = await existing(key)
      if (hit) return hit
      if (!pending.has(key))
        pending.set(
          key,
          prepare(key).finally(() => pending.delete(key)),
        )
      return pending.get(key)
    },
    diagnostics: () => ({
      active,
      queued: queue.length,
      pending: pending.size,
    }),
  }
}

export function bubbleMap3Assets(root) {
  const assets = createBubbleAssets(root)
  async function middleware(req, res, next) {
    const prefix = '/bubble/data/'
    if (!req.url?.startsWith(prefix)) return next()
    const controller = new AbortController()
    res.once?.('close', () => controller.abort())
    try {
      const key = decodeURIComponent(req.url.split('?')[0].slice(prefix.length))
      if (!validBubbleKey(key)) {
        res.statusCode = 400
        res.end()
        return
      }
      if (req.method && !['GET', 'HEAD'].includes(req.method)) {
        res.statusCode = 405
        res.end()
        return
      }
      const file = await assets.resolve(key)
      if (controller.signal.aborted) return
      if (!file) {
        res.statusCode = 404
        res.end(`Missing local Bubble resource: ${key}`)
        return
      }
      const response = await fileResponse(
        file,
        new Request('http://localhost/', {
          method: req.method ?? 'GET',
          headers: req.headers,
          signal: controller.signal,
        }),
        {
          'Content-Type': key.endsWith('.json')
            ? 'application/json'
            : key.endsWith('.wasm')
              ? 'application/wasm'
              : key.endsWith('.js')
                ? 'text/javascript'
                : key.endsWith('.png')
                  ? 'image/png'
                  : key.endsWith('.avif')
                    ? 'image/avif'
                    : 'application/octet-stream',
          'Cache-Control': 'no-cache',
        },
      )
      res.statusCode = response.status
      response.headers.forEach((value, name) => res.setHeader(name, value))
      if (!response.body) {
        res.end()
        return
      }
      await pipeline(Readable.fromWeb(response.body), res)
    } catch (error) {
      if (!controller.signal.aborted) {
        res.statusCode = 500
        res.end(String(error))
      }
    }
  }
  const attach = (server) => {
    server.middlewares.use(middleware)
  }
  return {
    name: 'bubble-native-assets',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}
