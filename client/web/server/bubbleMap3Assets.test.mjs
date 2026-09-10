import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { brotliCompressSync } from 'node:zlib'
import { Writable } from 'node:stream'
import { bubbleMap3Assets, createBubbleAssets } from './bubbleMap3Assets.mjs'
const sha = (data) => createHash('sha256').update(data).digest('hex')
async function fixture(t, corrupt = false) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'map3-assets-test-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const raw = Buffer.from('verified map document'),
    packed = brotliCompressSync(raw),
    hash = sha(packed),
    pack = sha('pack')
  const cache = path.join(root, 'bubble/BubbleGame')
  const directory = path.join(cache, 'sources/test/manifests/test/objects')
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(
    path.join(directory, 'manifest.json'),
    JSON.stringify({
      assets: {
        'map3/maps/1/map.bin.br': {
          hash,
          size: packed.length,
          carrier: {
            kind: 'pack',
            packHash: pack,
            offset: 4,
            length: packed.length,
          },
        },
      },
    }),
  )
  const file = path.join(cache, `packs/sha256/${pack.slice(0, 2)}/${pack}.pack`)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(
    file,
    Buffer.concat([
      Buffer.from('head'),
      corrupt ? Buffer.alloc(packed.length) : packed,
    ]),
  )
  let middleware
  bubbleMap3Assets(root).configureServer({
    middlewares: {
      use(fn) {
        middleware = fn
      },
    },
  })
  async function request(url, headers = {}) {
    return new Promise((resolve) => {
      const chunks = []
      const response = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.from(chunk))
          callback()
        },
      })
      response.statusCode = 200
      response.headers = {}
      response.setHeader = (k, v) => {
        response.headers[k.toLowerCase()] = String(v)
      }
      response.on('finish', () =>
        resolve({
          status: response.statusCode,
          body: Buffer.concat(chunks),
          headers: response.headers,
        }),
      )
      middleware({ url, method: 'GET', headers }, response, () =>
        resolve({ next: true }),
      )
    })
  }
  return { root, raw, request }
}
test('serves only the verified carrier range, decompresses Brotli, then uses offline prepared files', async (t) => {
  const f = await fixture(t)
  const result = await f.request('/bubble/data/map3/maps/1/map.bin')
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, f.raw)
  assert.deepEqual(
    await fs.readFile(
      path.join(f.root, 'client/web/public/bubble/data/map3/maps/1/map.bin'),
    ),
    f.raw,
  )
  assert.deepEqual(
    (await f.request('/bubble/data/map3/maps/1/map.bin')).body,
    f.raw,
  )
})
test('rejects corrupt resources without publishing them', async (t) => {
  const f = await fixture(t, true),
    result = await f.request('/bubble/data/map3/maps/1/map.bin')
  assert.equal(result.status, 500)
  assert.match(result.body.toString(), /Invalid asset hash/)
  await assert.rejects(
    fs.access(
      path.join(f.root, 'client/web/public/bubble/data/map3/maps/1/map.bin'),
    ),
  )
})
test('does not expose cache state or traversal paths', async (t) => {
  const f = await fixture(t)
  for (const url of [
    '/bubble/data/map3/%2e%2e/sources.json',
    '/bubble/data/sources.json',
  ])
    assert.equal((await f.request(url)).status, 400)
  assert.equal(
    (await f.request('/bubble/data/map3/maps/9/map.bin')).status,
    404,
  )
  assert.deepEqual(await f.request('/game-data/maps/1'), { next: true })
})

test('supports the exact HTTP ranges required by Bubble image packs on first preparation', async (t) => {
  const f = await fixture(t)
  const result = await f.request('/bubble/data/map3/maps/1/map.bin', {
    range: 'bytes=2-6',
  })
  assert.equal(result.status, 206)
  assert.deepEqual(result.body, f.raw.subarray(2, 7))
  assert.equal(result.headers['content-range'], `bytes 2-6/${f.raw.length}`)
  assert.equal(result.headers['content-length'], '5')
})
test('serves native actor resources from a Brotli manifest without exposing other namespaces', async (t) => {
  const f = await fixture(t)
  const manifest = path.join(
    f.root,
    'bubble/BubbleGame/sources/test/manifests/test/objects/manifest.json',
  )
  const doc = JSON.parse(await fs.readFile(manifest, 'utf8'))
  doc.assets['b/714/motion.bin.br'] = doc.assets['map3/maps/1/map.bin.br']
  await fs.writeFile(manifest, brotliCompressSync(JSON.stringify(doc)))
  const result = await f.request('/bubble/data/b/714/motion.bin')
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, f.raw)
  const blocked = await f.request('/bubble/data/accounts.json')
  assert.equal(blocked.status, 400)
})

test('deduplicates concurrent preparations and leaves no partial files after failure', async (t) => {
  const f = await fixture(t)
  const assets = createBubbleAssets(f.root)
  const files = await Promise.all(
    Array.from({ length: 12 }, () => assets.resolve('map3/maps/1/map.bin')),
  )
  assert.equal(new Set(files).size, 1)
  assert.deepEqual(await fs.readFile(files[0]), f.raw)
  assert.deepEqual(assets.diagnostics(), { active: 0, queued: 0, pending: 0 })
  assert.deepEqual(await fs.readdir(path.dirname(files[0])), ['map.bin'])
})
