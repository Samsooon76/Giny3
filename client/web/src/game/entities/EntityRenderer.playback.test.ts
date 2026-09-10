import { afterEach, expect, it, vi } from 'vitest'
import { EntityRenderer } from './EntityRenderer'
import { adaptEntityDocument } from './adapter'
afterEach(()=>vi.useRealTimers())

it('releases at the rendered SHOT and keeps playing the rest of the cast', async()=>{
  vi.useFakeTimers()
  const entity=new EntityRenderer()
  const frames=Array.from({length:20},()=>[{part_ref:'empty'}])
  await entity.load(adaptEntityDocument({frame_rate:25,parts:{},animations:{AnimStatique_1:{frames:[[{part_ref:'empty'}]]},AnimAttaque110_1:{frames,events:[{frame:10,text:'SHOT'}]}}}))
  let released=false
  const playing=entity.playOnce(['AnimAttaque110'],new AbortController().signal,false,'shot').then(()=>{released=true})
  await Promise.resolve()
  // Wall clock alone must not launch the impact before any cast frame rendered.
  await vi.advanceTimersByTimeAsync(600)
  expect(released).toBe(false)
  entity.tick(0.41)
  await playing
  expect(entity.player.animationName).toBe('AnimAttaque110_1')
  expect(entity.player.playing).toBe(true)
  entity.tick(0.5)
  expect(entity.player.animationName).toBe('AnimStatique_1')
  entity.destroy()
  expect(vi.getTimerCount()).toBe(0)
})
it('cancels on destruction without leaving a pending sequence or timer', async()=>{
  vi.useFakeTimers()
  const entity=new EntityRenderer()
  await entity.load(adaptEntityDocument({parts:{},animations:{AnimStatique_1:{frames:[[{part_ref:'empty'}]]},AnimAttaque110_1:{frames:[[{part_ref:'empty'}],[{part_ref:'empty'}],[{part_ref:'empty'}]]}}}))
  const playing=entity.playOnce(['AnimAttaque110'],new AbortController().signal)
  await Promise.resolve()
  entity.destroy()
  await playing
  expect(vi.getTimerCount()).toBe(0)
})

it('releases partial texture ownership if entity preparation fails', async () => {
  const entity = new EntityRenderer(), releaseSource = vi.fn(), releaseBaked = vi.fn()
  const resources = entity as unknown as { loadTextures(): Promise<void>; textureLease: { release(): void }; bakedReleases: Array<() => void> }
  vi.spyOn(resources, 'loadTextures').mockImplementation(async () => {
    resources.textureLease = { release: releaseSource }
    resources.bakedReleases.push(releaseBaked)
    throw new Error('recolor admission refused')
  })
  await expect(entity.load(adaptEntityDocument({ parts: {}, animations: {} }))).rejects.toThrow('admission refused')
  expect(entity.root.destroyed).toBe(true)
  expect(releaseSource).toHaveBeenCalledOnce()
  expect(releaseBaked).toHaveBeenCalledOnce()
  entity.destroy()
  expect(releaseSource).toHaveBeenCalledOnce()
})
