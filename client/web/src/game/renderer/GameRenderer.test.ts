import { expect, it, vi } from 'vitest'
import { GameRenderer } from './GameRenderer'
import { cellIdToWorld } from '../cells/CellGrid'
import type { WorldSession } from '../../giny/types'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
const session = (mapId: number, cellId = 276) =>
  ({
    mapId,
    cellId,
    direction: 1,
    character: { id: 101, name: 'Giny', look: '{1}' },
    actors: [],
    interactives: [],
  }) as unknown as WorldSession
const internal = (renderer: GameRenderer) =>
  renderer as unknown as {
    walk(cell: number): Promise<void>
    loadMap(id: number): Promise<void>
    hover(x: number, y: number): void
  }

it('highlights the enabled interactive element under the pointer', async () => {
  const current = session(1) as WorldSession,
    setGfxHoverRef = vi.fn()
  current.interactives = [
    { element_id: 42, cell_id: 123, enabled: true },
  ] as unknown as WorldSession['interactives']
  const renderer = new GameRenderer({ session: current, onStats: () => {} })
  Object.assign(renderer, {
    loading: false,
    canvas: { style: {} },
    scene: {
      clientToWorld: () => ({ x: 0, y: 0 }),
      loadedScene: {
        map: { elements: { background: [{ interactionId: 42 }] } },
      },
      pickGfxElementRefsAtClientExact: async () => [
        { group: 'background', index: 0 },
      ],
      setGfxHoverRef,
    },
    actors: {
      entries: [],
      worldToCell: () => 123,
    },
  })

  internal(renderer).hover(25, 30)

  await vi.waitFor(() =>
    expect(setGfxHoverRef).toHaveBeenCalledWith(
      { group: 'background', index: 0 },
      'select',
    ),
  )
  expect((renderer as unknown as { canvas: { style: { cursor: string } } }).canvas.style.cursor)
    .toBe('pointer')
})

it('waits for server validation before animating and confirms only the actual arrival', async () => {
  const ack = deferred<number[]>(),
    arrival = deferred<boolean>(),
    requestMovement = vi.fn(() => ack.promise),
    confirmMovement = vi.fn(),
    move = vi.fn(() => arrival.promise)
  const renderer = new GameRenderer({
    session: session(1),
    onStats: () => {},
    requestMovement,
    confirmMovement,
  })
  Object.assign(renderer, {
    actors: {
      entries: [
        {
          descriptor: { id: 101 },
          entity: { cellId: 276 },
          movement: { moving: false },
        },
      ],
      pathTo: () => [276, 290, 303],
      move,
    },
  })
  const work = internal(renderer).walk(303)
  expect(requestMovement).toHaveBeenCalledWith([276, 290, 303], 1)
  expect(move).not.toHaveBeenCalled()
  expect(confirmMovement).not.toHaveBeenCalled()
  ack.resolve([276, 290, 303])
  await vi.waitFor(() => expect(move).toHaveBeenCalled())
  expect(confirmMovement).not.toHaveBeenCalled()
  arrival.resolve(true)
  await work
  expect(confirmMovement).toHaveBeenCalledExactlyOnceWith(1)
})

it('discards an obsolete movement ACK after a map transition', async () => {
  const ack = deferred<number[]>(),
    move = vi.fn(),
    confirmMovement = vi.fn()
  const renderer = new GameRenderer({
    session: session(1),
    onStats: () => {},
    requestMovement: () => ack.promise,
    confirmMovement,
  })
  Object.assign(renderer, {
    actors: {
      entries: [
        {
          descriptor: { id: 101 },
          entity: { cellId: 276 },
          movement: { moving: false },
        },
      ],
      pathTo: () => [276, 290],
      move,
    },
  })
  const work = internal(renderer).walk(290)
  Object.assign(renderer, { mapId: 2 })
  ack.resolve([276, 290])
  await work
  expect(move).not.toHaveBeenCalled()
  expect(confirmMovement).not.toHaveBeenCalled()
})

it('reveals only the latest map after its native frame is rendered', async () => {
  const first = deferred<void>(),
    events: string[] = [],
    render = vi.fn(() => events.push('render')),
    sync = vi.fn(async () => {})
  const renderer = new GameRenderer({
    mapId: 1,
    onStats: () => {},
    onLoading: (on) => events.push(on ? 'loading' : 'ready'),
  })
  const cells = Array.from({ length: 560 }, () => ({
    l: 3,
    f: 0,
    s: 0,
    c: 0,
    z: 0,
    linked_zone: 0,
  }))
  const load = vi.fn(async (id: number) => {
    if (id === 2) await first.promise
  })
  Object.assign(renderer, {
    scene: {
      load,
      loadedScene: { map: {} },
      supportsBc7Textures: true,
      fitCamera: () => {},
      render,
      getBenchStats: () => ({}),
      getResourceStats: () => ({}),
    },
    actors: {
      sync,
      cells,
      entries: [],
      bindMap: () => ({
        cells,
        neighbours: { top: 0, bottom: 0, left: 0, right: 0 },
      }),
      cellPosition: cellIdToWorld,
      tick: () => [],
      syncInteractives: () => {},
    },
  })
  vi.stubGlobal('location', { search: '' })
  const stale = internal(renderer).loadMap(2)
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1))
  const latest = internal(renderer).loadMap(3)
  first.resolve()
  await Promise.all([stale, latest])
  expect(renderer.performanceSnapshot().mapId).toBe(3)
  expect(render).toHaveBeenCalledTimes(1)
  expect(events.slice(-2)).toEqual(['render', 'ready'])
  vi.unstubAllGlobals()
})
