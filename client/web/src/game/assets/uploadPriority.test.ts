import { expect, it, vi } from 'vitest'
import type { Renderer, Texture } from 'pixi.js'
vi.mock('./PreparationBudget', () => ({ preparationBudget: { checkpoint: vi.fn(async () => undefined) } }))
import { preparationBudget } from './PreparationBudget'
import { warmTextures } from './textures'
it('uploads visible textures before queued neighbours and drops cancelled uploads', async () => {
  let resume!: () => void, entered!: () => void
  const ready = new Promise<void>(resolve => { entered = resolve })
  vi.mocked(preparationBudget.checkpoint).mockImplementationOnce(() => { entered(); return new Promise<void>(resolve => { resume = resolve }) })
  const order: string[] = []
  const renderer = { texture: { initSource: (source: { id: string }) => order.push(source.id) } } as unknown as Renderer
  const texture = (id: string) => ({ source: { id } }) as unknown as Texture
  const first = warmTextures([texture('first')], renderer)
  await ready
  const background = warmTextures([texture('background')], renderer, undefined, { priority: 'background' })
  const controller = new AbortController()
  const cancelled = warmTextures([texture('cancelled')], renderer, controller.signal)
  const rejected = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
  const visible = warmTextures([texture('visible')], renderer)
  controller.abort(); await rejected; resume()
  await Promise.all([first, background, visible])
  expect(order).toEqual(['first', 'visible', 'background'])
})
