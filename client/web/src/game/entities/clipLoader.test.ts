import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { adaptEntityDocument } from './adapter'
import { animationCache, loadEntityClip } from './clipLoader'

const fetchMock = vi.fn()
const entity = () => adaptEntityDocument({
  frame_rate: 25,
  animations: { idle: { frame_count: 1 }, run: { frame_count: 2 } },
  animation_files: { idle: 'optimized/clips/idle.json', run: 'optimized/clips/run.json' },
})
const response = () => new Response(JSON.stringify({ frames: [[{
  part_ref: 'body', slot: 2, transform: [1, 0, 4, 0, 1, 8],
  color: { multiplicative: [1, .5, 1, 1], alpha: .6 }, visible_leaf_indices: [0, 2],
}]] }))
beforeEach(() => { animationCache.clear(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => vi.unstubAllGlobals())

it('loads only the requested animation, coalesces it, and preserves drawable metadata', async () => {
  const data = entity()
  expect(Object.keys(data.animations)).toEqual(['idle', 'run'])
  expect(fetchMock).not.toHaveBeenCalled()
  fetchMock.mockResolvedValue(response())
  const [a, b] = await Promise.all([loadEntityClip(data, 'idle'), loadEntityClip(data, 'idle')])
  expect(a).toBe(b)
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/game-data/optimized/clips/idle.json', { signal: expect.any(AbortSignal) })
  expect(a.frames[0][0]).toMatchObject({ partRef: 'body', transform: [1, 0, 4, 0, 1, 8], color: { alpha: .6 }, visibleLeafIndices: [0, 2] })
  expect(data.animations.idle.frames).toEqual([])
})

it('cancels a consumer without cancelling the clip shared by another actor', async () => {
  let resolve!: (value: Response) => void
  fetchMock.mockReturnValue(new Promise<Response>(r => { resolve = r }))
  const controller = new AbortController()
  const cancelled = loadEntityClip(entity(), 'idle', controller.signal)
  const kept = loadEntityClip(entity(), 'idle')
  controller.abort()
  await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
  resolve(response())
  expect((await kept).frames).toHaveLength(1)
})

it('evicts failed clips so a later request can retry', async () => {
  fetchMock.mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(response())
  await expect(loadEntityClip(entity(), 'run')).rejects.toThrow('404')
  await expect(loadEntityClip(entity(), 'run')).resolves.toMatchObject({ frameRate: 25 })
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('promotes a queued background clip requested by a visible actor', async () => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const data = entity()
  const starts: string[] = []
  fetchMock.mockImplementation(async (url: string) => { starts.push(url); await gate; return response() })
  const request = (name: string, priority: 'active' | 'background') => {
    data.animationFiles![name] = `optimized/clips/${name}.json`
    return loadEntityClip(data, name, undefined, priority)
  }
  const occupied = Array.from({ length: 6 }, (_, i) => request(`busy-${i}`, 'background'))
  await vi.waitFor(() => expect(starts).toHaveLength(6))
  const background = request('background', 'background')
  const promoted = request('promoted', 'background')
  const visible = request('promoted', 'active')
  release()
  await Promise.all([...occupied, background, promoted, visible])
  expect(starts.slice(6)).toEqual(['/game-data/optimized/clips/promoted.json', '/game-data/optimized/clips/background.json'])
})
