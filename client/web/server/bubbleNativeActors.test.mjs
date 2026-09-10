import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NativeActors } from '../public/bubble/native-actors.js'
import { J as decodeMap } from '../public/bubble/runtime/data-loader-utils-Btf16hSR.js'
const dataRoot = fileURLToPath(
  new URL('../public/bubble/data/', import.meta.url),
)

// Exercise the real native templates and movement code with local assets only.
// No WebGL substitute is used for visual assertions: those are checked in-browser.
test('native actors load offline, animate, arrive and release their leases', async (t) => {
  const original = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = new URL(String(input), 'http://localhost'),
      prefix = '/bubble/data/'
    assert.ok(
      url.pathname.startsWith(prefix),
      `Unexpected resource ${url.pathname}`,
    )
    const file = path.resolve(dataRoot, url.pathname.slice(prefix.length))
    assert.ok(file.startsWith(dataRoot))
    try {
      return new Response(await fs.readFile(file))
    } catch (error) {
      if (error.code === 'ENOENT') return new Response(null, { status: 404 })
      throw error
    }
  }
  t.after(() => {
    globalThis.fetch = original
  })
  const textures = new Set()
  const actors = new NativeActors({
    entityTextureSizes: new Map(),
    ensureEntityTexture: async (url) => textures.add(url),
    isEntityTextureReady: (url) => textures.has(url),
  })
  t.after(() => actors.destroy())
  await actors.init()
  const map = decodeMap(
    new Uint8Array(
      await fs.readFile(path.join(dataRoot, 'map3/maps/204998153/map.bin')),
    ),
  )
  actors.scene.loadedScene = { map, instances: { interactive: [], hitbox: [] } }
  actors.bindMap(map, 204998153)
  await actors.sync([
    {
      id: 1,
      name: 'Character descriptor',
      kind: 'character',
      look: '{1|10,2012|1=#e3ad72,2=#8b452f,3=#db8a35,4=#66512e,5=#302b28|50}',
      cell: 276,
      direction: 1,
    },
    {
      id: 2,
      name: 'NPC descriptor',
      kind: 'npc',
      look: '{714}',
      cell: 330,
      direction: 1,
    },
    {
      id: 3,
      name: 'Monster descriptor',
      kind: 'monster',
      look: '{4907|||130}',
      cell: 385,
      direction: 1,
    },
  ])
  assert.equal(actors.entries.length, 3)
  assert.equal(new Set(actors.entries.map((e) => e.entity.cellId)).size, 3)
  for (const entry of actors.entries) {
    assert.ok(
      entry.entity.animManager.hasResolvableDirection(
        entry.entity.resolveAnimBase('AnimMarche'),
        1,
      ),
      `${entry.descriptor.name} has walking frames`,
    )
    const targets = actors.cells
      .map((_, i) => i)
      .filter(
        (i) => actors.isWalkable(i) && Math.abs(i - entry.entity.cellId) < 60,
      )
    let route = []
    for (const target of targets) {
      route = actors.pathTo(entry.descriptor.id, target)
      if (route.length > 2) break
    }
    assert.ok(route.length > 1, `${entry.descriptor.name} has a route`)
    const arrival = actors.move(entry.descriptor.id, route)
    const frames = new Set()
    for (let frame = 0; frame < 2000 && entry.movement.moving; frame++) {
      actors.tick(0.04)
      frames.add(entry.entity.currentFrame)
    }
    assert.equal(await arrival, true)
    assert.equal(entry.movement.moving, false)
    assert.equal(entry.entity.cellId, route.at(-1))
    assert.ok(frames.size > 1, `${entry.descriptor.name} animates while moving`)
    assert.equal(entry.moves, 1)
  }
  assert.deepEqual(actors.pathTo(1, -1), [])
  const previous = actors.entries.map((e) => e.entity)
  actors.destroy()
  assert.ok(
    previous.every((e) => e.heldGroups.size === 0 && e.animManager === null),
  )
  actors.destroy()
})

test('Giny snapshots reconcile native actors without interrupting confirmed paths or replaying duplicate movement', async (t) => {
  const original = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = new URL(String(input), 'http://localhost')
    assert.ok(url.pathname.startsWith('/bubble/data/'))
    try {
      return new Response(
        await fs.readFile(
          path.join(dataRoot, url.pathname.slice('/bubble/data/'.length)),
        ),
      )
    } catch (error) {
      if (error.code === 'ENOENT') return new Response(null, { status: 404 })
      throw error
    }
  }
  t.after(() => {
    globalThis.fetch = original
  })
  const map = decodeMap(
      new Uint8Array(
        await fs.readFile(path.join(dataRoot, 'map3/maps/204998153/map.bin')),
      ),
    ),
    textures = new Set()
  const scene = {
    loadedScene: { map, instances: { interactive: [], hitbox: [] } },
    entityTextureSizes: new Map(),
    ensureEntityTexture: async (url) => textures.add(url),
    isEntityTextureReady: (url) => textures.has(url),
  }
  const actors = new NativeActors(scene)
  t.after(() => actors.destroy())
  await actors.init()
  actors.bindMap(map, 204998153)
  const roster = [
    {
      id: 91,
      name: 'Giny',
      kind: 'character',
      look: '{1|10,2012|1=#e3ad72,2=#8b452f,3=#db8a35,4=#66512e,5=#302b28|50}',
      cell: 276,
      direction: 1,
    },
    {
      id: -52,
      name: 'Mob',
      kind: 'monster',
      look: '{4907|||130}',
      cell: 385,
      direction: 1,
    },
  ]
  await actors.sync(roster)
  assert.equal(actors.entries.length, 2)
  const route = actors.pathTo(91, 357),
    entry = actors.entries.find((e) => e.descriptor.id === 91),
    arrival = actors.move(91, route)
  actors.tick(0.1)
  await actors.sync(roster)
  assert.equal(entry.movement.moving, true)
  const duplicate = actors.move(91, route)
  assert.equal(duplicate, arrival)
  for (let i = 0; i < 1000 && entry.movement.moving; i++) actors.tick(0.04)
  assert.equal(await arrival, true)
  assert.equal(entry.entity.cellId, 357)
  await actors.move(91, route)
  assert.equal(entry.moves, 1)
  const controller = new AbortController(),
    back = actors.move(91, [357, 343, 329], controller.signal)
  actors.tick(0.04)
  controller.abort()
  assert.equal(await back, false)
  assert.notEqual(entry.entity.cellId, 329)
  const removed = entry.entity
  await actors.sync([roster[1]])
  assert.equal(removed.heldGroups.size, 0)
  assert.equal(actors.entries[0].descriptor.id, -52)
})
