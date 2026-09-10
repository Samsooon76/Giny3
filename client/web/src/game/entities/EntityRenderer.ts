import { retainDocument, updateDocumentEstimate } from '../assets/documentOwnership'
import { estimateEntityBytes, estimateEntityAnimationBytes } from './types'
import { preparationBudget } from '../assets/PreparationBudget'
import { acquireBakedTexture } from './bakedTextures'
import type { LoadOptions } from '../assets/TaskQueue'
import { loadEntityClip } from './clipLoader'
import { Container, Mesh, MeshGeometry, Point, Texture, type Renderer, type UniformGroup } from 'pixi.js'
import { acquireTextures, warmTextures, type TextureSet } from '../assets/textures'
import { throwIfAborted } from '../assets/TaskQueue'
import { releaseMeshTexture } from '../renderer/releaseMeshTexture'
import {
  ActorRecolorShader,
  NEUTRAL_RECOLOR,
  createActorRecolorUniforms,
  isNeutralRecolor,
  recolorToUniform,
  setActorRecolorUniform,
  type ActorRecolor,
} from '../renderer/ActorRecolor'
import { rowFromWorldY, sortableZIndex } from '../cells/CellGrid'
import { gameDataUrl } from '../../data/assetUrl'
import { transformRestPositions } from './affine'
import { AnimationPlayer } from './AnimationPlayer'
import { hexToRgb } from './look'
import type { DirectionalPose, EntityLeaf, WebEntityData } from './types'
import { resolveAttackAnimKinds } from '../combat/spellScripts'

const MIRROR_SOURCE: Record<number, number> = { 3: 1, 4: 0, 7: 5 }
const IDLE_KINDS = ['AnimStatiqueExplo0', 'AnimStatiqueExploNewAge', 'AnimStatique']
const WALK_KINDS = ['AnimMarche']
const RUN_KINDS = ['AnimCourse', 'AnimMarche']

type PooledMesh = {
  key: string
  wrap: Container
  mesh: Mesh
  restPositions: Float32Array
  /** Used for actor recolouring or animation colour addition. */
  shader: ActorRecolorShader | null
}

/** Reused by containsWorldPoint: hover runs on every pointer move. */
const HIT_POINT = new Point()

export class EntityRenderer {
  readonly root = new Container({ label: 'Entity' })
  readonly player = new AnimationPlayer()
  private data: WebEntityData | null = null
  private poseRequest = 0
  private textures = new Map<string, Texture>()
  private textureLease?: TextureSet
  private readonly loadController = new AbortController()
  private documentBaseBytes = 0
  private releaseDocument?: () => void
  private bakedReleases: Array<() => void> = []
  private baked = new Map<string, Texture>()
  private pinnedClips = new Set<string>()
  private pool = new Map<string, PooledMesh>()
  private lookScale = 1
  facing = 1
  meshCount = 0
  renderVersion = 0
  private flippedX = false
  private flippedY = false
  private propState: number | null = null
  private stateTransition: { name: string; target: string } | null = null
  private recolor: ActorRecolor | null = null
  private recolorUniforms: UniformGroup | null = null
  private playbackWaiters = new Set<() => void>()
  private readonly loadPriority: LoadOptions['priority']
  private renderer?: Renderer

  constructor(renderer?: Renderer, priority: LoadOptions['priority'] = 'active') {
    this.loadPriority = priority
    this.renderer = renderer
    this.root.eventMode = 'none'
    this.root.sortableChildren = false
  }

  async load(data: WebEntityData, signal?: AbortSignal, initialAnimation?: string): Promise<void> {
    await preparationBudget.checkpoint({ signal, priority: this.loadPriority })
    const abort = () => this.destroy()
    signal?.addEventListener('abort', abort, { once: true })
    try {
      this.data = { ...data, animations: { ...data.animations } }
      this.lookScale = data.look.scale || data.scale || 1
      this.documentBaseBytes = estimateEntityBytes({ ...this.data, animations: {} })
      this.releaseDocument?.()
      this.releaseDocument = retainDocument(this.data, 'scene:entity', estimateEntityBytes(this.data))
      this.player.setup(this.data)
      await this.loadTextures(data)
      throwIfAborted(this.loadController.signal)
      this.setMirrored(false)
      const idle = initialAnimation && this.player.hasAnimation(initialAnimation)
        ? { name: initialAnimation, mirror: false }
        : this.resolveDirectionalAnimation(IDLE_KINDS, 1)
      if (idle) {
        this.data.animations[idle.name] = await loadEntityClip(this.data, idle.name, this.loadController.signal, this.loadPriority)
        await preparationBudget.checkpoint({ signal: this.loadController.signal, priority: this.loadPriority })
        this.applyPose(idle, true)
        return
      }
      // Map props (doors, ore, mine entrances) are Animator2D objects too, but
      // their animations are named AnimState<n>: fall back to the first pose so
      // they are drawn instead of staying invisible.
      const fallback = Object.keys(data.animations).sort()[0]
      if (fallback) {
        this.data.animations[fallback] = await loadEntityClip(this.data, fallback, this.loadController.signal, this.loadPriority)
        await preparationBudget.checkpoint({ signal: this.loadController.signal, priority: this.loadPriority })
        this.applyPose({ name: fallback, mirror: false }, true)
      }
    } catch (error) { this.destroy(); throw error } finally { signal?.removeEventListener('abort', abort) }
  }

  /**
   * Does a world-space point land on drawn geometry?
   *
   * Triangle-accurate through `Mesh.containsPoint`, so a tall plant is only
   * picked where its art actually is instead of anywhere in its bounding box.
   * Hidden pool entries are skipped: they belong to poses not drawn right now.
   */
  containsWorldPoint(point: { x: number; y: number }): boolean {
    for (const item of this.pool.values()) {
      if (!item.wrap.visible || !item.wrap.parent || item.mesh.destroyed || !item.mesh.geometry) {
        continue
      }
      // Callers supply map coordinates, while worldTransform includes the
      // camera pan/zoom. toLocal also updates transforms before the next render.
      const local = item.mesh.toLocal(point, this.root.parent ?? undefined, HIT_POINT)
      if (item.mesh.containsPoint(local)) {
        return true
      }
    }
    return false
  }

  /** The recolour in force, or null while the actor wears its base colours. */
  get actorRecolor(): ActorRecolor | null {
    return this.recolor
  }

  /**
   * Shift the whole actor in HSV, the way the official client draws a
   * recoloured monster. Neutral values (or null) restore the base art.
   *
   * Parts without recolouring or additive animation colours keep Pixi's
   * batched mesh shader.
   */
  setRecolor(recolor: ActorRecolor | null): void {
    this.renderVersion++
    const neutral = isNeutralRecolor(recolor)
    this.recolor = neutral ? null : recolor
    if (neutral) {
      for (const item of this.pool.values()) this.releaseRecolor(item)
      this.recolorUniforms = null
      // Removing an actor tint must retain the current animation's colours,
      // including on a paused pose that will not advance to another frame.
      this.drawFrame()
      return
    }
    this.recolorUniforms ??= createActorRecolorUniforms()
    setActorRecolorUniform(
      this.recolorUniforms,
      this.recolor ? recolorToUniform(this.recolor) : NEUTRAL_RECOLOR,
    )
    for (const item of this.pool.values()) {
      this.bindRecolor(item, item.mesh.texture)
    }
  }

  /** Horizontal flip carried by a map element transform. */
  setFlip(flipX: boolean, flipY = false): void {
    this.flippedX = flipX
    this.flippedY = flipY
    const scale = this.lookScale
    this.root.scale.set(flipX ? -scale : scale, flipY ? -scale : scale)
  }

  /**
   * Show the `AnimState<n>` pose of a map prop, mirroring the emulator's
   * stated-element state (0 active, 1 depleted, 2 being harvested). Returns
   * false when that clip is missing from the bundle — several prop animations
   * use encodings the extractor cannot decode yet, and the prop then keeps
   * whatever pose it already had rather than vanishing.
   */
  playState(state: number): boolean {
    const name = `AnimState${state}_0`
    if (!this.player.hasAnimation(name)) {
      return false
    }
    if (this.propState === state) return true
    const transition = this.propState === null ? '' : `AnimState${this.propState}_to_${name}`
    this.propState = state
    this.stateTransition = transition && this.player.hasAnimation(transition) ? { name: transition, target: name } : null
    this.applyPose({ name: this.stateTransition?.name ?? name, mirror: false }, true, !this.stateTransition && state === 2)
    // applyPose resets the scale through setMirrored: restore the map flip.
    this.setFlip(this.flippedX, this.flippedY)
    return true
  }

  /** Load ambient cycles before revealing the map; retain until this instance is destroyed. */
  async prepareAmbientClips(names: string[], signal?: AbortSignal): Promise<void> {
    const data = this.data
    if (!data) return
    for (const name of new Set(names)) {
      const clip = await loadEntityClip(data, name, signal, this.loadPriority)
      throwIfAborted(signal)
      data.animations[name] = clip
      this.pinnedClips.add(name)
      updateDocumentEstimate(data, this.documentBaseBytes + estimateEntityAnimationBytes(data.animations))
    }
  }

  playAmbient(name: string, loop = true): void {
    this.propState = null
    this.stateTransition = null
    this.applyPose({ name, mirror: false }, true, loop)
  }

  get lookRaw(): string {
    return this.data?.look.raw ?? ''
  }

  get animationName(): string {
    return this.player.animationName
  }

  hasRunAnimation(direction: number): boolean {
    return this.resolveDirectionalAnimation(['AnimCourse'], direction) != null
  }

  playIdle(): void {
    const pose = this.resolveDirectionalAnimation(IDLE_KINDS, this.facing)
    if (pose) {
      this.applyPose(pose, true)
    }
  }

  playMove(running: boolean): void {
    const kinds = running ? RUN_KINDS : WALK_KINDS
    const pose = this.resolveDirectionalAnimation(kinds, this.facing)
    if (pose) {
      this.applyPose(pose, true)
    }
  }

  playAttack(action: { type?: string; spell_id?: number; script_id?: number } = {}, breedId = 1): boolean {
    const kinds = resolveAttackAnimKinds(action, breedId)
    const pose = this.resolveDirectionalAnimation(kinds, this.facing)
    if (pose) {
      this.applyPose(pose, true)
      return true
    }
    return false
  }

  async playOnce(kinds: string[], signal: AbortSignal, stay = false, policy: 'end' | 'shot' | 'beginning' = 'end', frameOffset = 0): Promise<void> {
    const pose = this.resolveDirectionalAnimation(kinds, this.facing), data = this.data
    if (!pose || !data || signal.aborted) return
    const clip = await loadEntityClip(data, pose.name, signal, this.loadPriority)
    if (signal.aborted || this.root.destroyed) return
    data.animations[pose.name] = clip
    this.applyPose(pose, true)
    this.player.play(pose.name, false, true)
    if (frameOffset > 0) { this.player.frameIndex = Math.min(clip.frames.length - 1, Math.floor(frameOffset)); this.drawFrame() }
    const request = this.poseRequest
    await new Promise<void>(resolve => {
      const shot = clip.events?.find(event => event.text.toUpperCase() === 'SHOT')
      const finish = () => {
        clearTimeout(timeout)
        this.playbackWaiters.delete(update)
        signal.removeEventListener('abort', finish)
        this.loadController.signal.removeEventListener('abort', finish)
        if (!this.root.destroyed && !this.loadController.signal.aborted && !stay && this.poseRequest === request) this.playIdle()
        resolve()
      }
      const update = () => {
        if (this.poseRequest !== request || !this.player.playing) { finish(); return }
        if (policy === 'beginning' || (policy === 'shot' && shot && this.player.frameIndex >= shot.frame)) resolve()
      }
      // SHOT follows the frames actually rendered, even when the ticker stalls.
      // A watchdog only releases a renderer that can no longer tick.
      const timeout = setTimeout(finish, Math.max(10000, clip.frames.length / (clip.frameRate || 25) * 4000))
      this.playbackWaiters.add(update)
      signal.addEventListener('abort', finish, { once: true })
      this.loadController.signal.addEventListener('abort', finish, { once: true })
      update()
    })
  }

  setFacing(direction: number): void {
    if (direction >= 0) {
      this.facing = direction
    }
  }

  tick(deltaSeconds: number): void {
    if (this.root.destroyed) {
      return
    }
    if (this.player.tick(deltaSeconds)) {
      this.drawFrame()
    }
    for (const update of [...this.playbackWaiters]) update()
    if (this.stateTransition && this.player.animationName === this.stateTransition.name && !this.player.playing) {
      const name = this.stateTransition.target
      this.stateTransition = null
      this.applyPose({ name, mirror: false }, true, this.propState === 2)
    }
  }

  syncZIndex(): void {
    this.root.zIndex = sortableZIndex(rowFromWorldY(this.root.position.y), 500)
  }

  destroy(): void {
    if (this.root.destroyed) return
    this.loadController.abort()
    this.root.removeFromParent()
    for (const item of this.pool.values()) {
      item.mesh.texture = Texture.EMPTY
      this.releaseRecolor(item)
      item.mesh.destroy()
      item.wrap.destroy()
    }
    this.pool.clear()
    this.recolorUniforms = null
    for (const texture of this.baked.values()) releaseMeshTexture(this.renderer, texture)
    for (const release of this.bakedReleases) release()
    this.bakedReleases = []
    this.baked.clear()
    for (const texture of this.textures.values()) releaseMeshTexture(this.renderer, texture)
    this.textures.clear()
    this.textureLease?.release()
    this.textureLease = undefined
    this.releaseDocument?.(); this.releaseDocument = undefined
    this.data = null
    this.player.clear()
    this.renderer = undefined
    this.root.destroy({ children: true })
  }

  resolveDirectionalAnimation(kinds: string[], direction: number): DirectionalPose | null {
    const authored = ((direction % 8) + 8) % 8
    const exact = this.findDirectionalAnimation(kinds, authored)
    if (exact) {
      return { name: exact, mirror: false }
    }
    const mirroredFrom = MIRROR_SOURCE[authored]
    if (mirroredFrom !== undefined) {
      const mirrored = this.findDirectionalAnimation(kinds, mirroredFrom)
      if (mirrored) {
        return { name: mirrored, mirror: true }
      }
    }
    const fallbackDirection = authored <= 3 ? 1 : 5
    const fallback = this.findDirectionalAnimation(kinds, fallbackDirection)
    if (!fallback) {
      return null
    }
    return { name: fallback, mirror: authored === 3 || authored === 7 }
  }

  private applyPose(pose: DirectionalPose, reset: boolean, loop = true): void {
    const data = this.data
    if (!data) return
    const request = ++this.poseRequest
    const clip = data.animations[pose.name]
    if (data.animationFiles?.[pose.name] && !clip?.frames.length) {
      void loadEntityClip(data, pose.name, this.loadController.signal, this.loadPriority).then(loaded => {
        if (request !== this.poseRequest || this.root.destroyed) return
        data.animations[pose.name] = loaded
        this.applyPose(pose, reset, loop)
        if (this.flippedX || this.flippedY) this.setFlip(this.flippedX, this.flippedY)
      }).catch(error => {
        if (request !== this.poseRequest || this.loadController.signal.aborted) return
        console.warn('[animation]', error)
        if (this.stateTransition?.name === pose.name) {
          const name = this.stateTransition.target
          this.stateTransition = null
          this.applyPose({ name, mirror: false }, true, this.propState === 2)
        }
      })
      return
    }
    const previous = this.player.animationName
    if (previous !== pose.name && data.animationFiles?.[previous] && !this.pinnedClips.has(previous)) {
      data.animations[previous] = { ...data.animations[previous], frames: [] }
    }
    this.setMirrored(pose.mirror)
    if (this.flippedX || this.flippedY) this.setFlip(this.flippedX, this.flippedY)
    const already = this.player.animationName === pose.name && this.player.playing
    this.player.play(pose.name, loop, reset && !already)
    updateDocumentEstimate(data, this.documentBaseBytes + estimateEntityAnimationBytes(data.animations))
    this.drawFrame()
  }

  private setMirrored(value: boolean): void {
    const scale = this.lookScale
    this.root.scale.set(value ? -scale : scale, scale)
  }

  private findDirectionalAnimation(kinds: string[], direction: number): string | null {
    if (!this.data) {
      return null
    }
    const names = Object.keys(this.data.animations).sort()
    for (const kind of kinds) {
      const exact = `${kind}_${direction}`
      if (this.player.hasAnimation(exact)) {
        return exact
      }
      for (const name of names) {
        if (name.startsWith(kind) && name.endsWith(`_${direction}`) && !name.includes('_to_')) {
          return name
        }
      }
    }
    return null
  }

  private async loadTextures(data: WebEntityData): Promise<void> {
    const urls = new Set<string>()
    for (const part of Object.values(data.parts)) {
      for (const leaf of part.leaves) {
        if (leaf.texture) {
          urls.add(gameDataUrl(leaf.texture))
        }
      }
    }
    const lease = await acquireTextures([...urls], { signal: this.loadController.signal, priority: this.loadPriority })
    try {
      await warmTextures(lease.values(), this.renderer, this.loadController.signal, { priority: this.loadPriority })
      throwIfAborted(this.loadController.signal)
      this.textureLease?.release()
      this.textureLease = lease
      this.textures = new Map(lease)
    } catch (error) { lease.release(); throw error }
    await this.bakeIndexedTextures(data)
  }

  private async bakeIndexedTextures(data: WebEntityData): Promise<void> {
    for (const part of Object.values(data.parts)) {
      for (const leaf of part.leaves) {
        if (leaf.indexedColor == null) {
          continue
        }
        const base = this.textures.get(gameDataUrl(leaf.texture))
        if (!base) {
          continue
        }
        const key = bakeKey(leaf.texture, leaf.indexedColor)
        if (this.baked.has(key)) {
          continue
        }
        const hex = data.look.colors[String(leaf.indexedColor)]
        if (!hex) {
          continue
        }
        await preparationBudget.checkpoint({ signal: this.loadController.signal, priority: this.loadPriority })
        const [r, g, b] = hexToRgb(hex)
        const lease = acquireBakedTexture(`${base.uid}:${r}:${g}:${b}`, base, () => bakeIndexed(base, r * 2, g * 2, b * 2))
        if (lease) { this.baked.set(key, lease.texture); this.bakedReleases.push(lease.release) }
      }
    }
  }

  private leafTexture(leaf: EntityLeaf): Texture | null {
    if (leaf.indexedColor != null) {
      const baked = this.baked.get(bakeKey(leaf.texture, leaf.indexedColor))
      if (baked) {
        return baked
      }
    }
    return this.textures.get(gameDataUrl(leaf.texture)) ?? null
  }

  private drawFrame(): void {
    this.renderVersion++
    if (!this.data || this.root.destroyed) {
      return
    }
    const seen = new Set<string>()
    let painted = 0
    for (const node of this.player.nodes()) {
      const part = this.data.parts[node.partRef]
      if (!part) {
        continue
      }
      const selection =
        node.visibleLeafIndices && node.visibleLeafIndices.length > 0
          ? new Set(node.visibleLeafIndices)
          : null
      for (let leafIndex = 0; leafIndex < part.leaves.length; leafIndex += 1) {
        if (selection && !selection.has(leafIndex)) {
          continue
        }
        const leaf = part.leaves[leafIndex]
        const texture = this.leafTexture(leaf)
        if (!texture) {
          continue
        }
        // Slot indexes are per-clip, not per body part. AnimStatiqueExplo0_1
        // slot 29 is Torse_1; the same index on _0 is Tete_0. Keying only by
        // slot reused SE rest vertices on every other facing.
        const key = `${node.slot}:${node.partRef}:${leafIndex}`
        const item = this.obtainMesh(key, leaf, texture)
        const geometry = item.mesh.geometry as MeshGeometry | null
        if (!geometry?.positions || !geometry.attributes?.aPosition) {
          continue
        }
        const positions = geometry.positions
        transformRestPositions(node.transform, leaf.skinTransform, item.restPositions, positions)
        geometry.attributes.aPosition.buffer.update()
        const mul = node.color.multiplicative
        item.mesh.tint = rgbTint(mul[0], mul[1], mul[2])
        item.mesh.alpha = node.color.alpha
        if (node.blend === 1) item.mesh.blendMode = 'add'
        else if (node.blend === 2) item.mesh.blendMode = 'multiply'
        else if (node.blend != null) item.mesh.blendMode = 'normal'
        // The adapter supplies decoded RGB for both composed actors and props.
        // Older actor exports (e.g. Feu de Joie) have no encoding marker but
        // still need their additive colour to compensate for the dark tint.
        const add = node.color.additive
        if (add[0] || add[1] || add[2]) {
          this.recolorUniforms ??= createActorRecolorUniforms()
          this.bindRecolor(item, texture, true)
        }
        else if (!this.recolor) this.releaseRecolor(item)
        item.shader?.setColorAdd(add)
        item.wrap.visible = true
        this.root.addChild(item.wrap)
        seen.add(key)
        painted += 1
      }
    }
    for (const [key, item] of this.pool) {
      if (!seen.has(key)) {
        item.wrap.visible = false
      }
    }
    this.meshCount = painted
  }

  private obtainMesh(key: string, leaf: EntityLeaf, texture: Texture): PooledMesh {
    const existing = this.pool.get(key)
    if (
      existing &&
      !existing.mesh.destroyed &&
      existing.mesh.geometry &&
      existing.restPositions.length === leaf.vertices.length * 2
    ) {
      const geometry = existing.mesh.geometry as MeshGeometry
      if (geometry.indices.length === leaf.indices.length) {
        existing.mesh.texture = texture
        this.bindRecolor(existing, texture)
        return existing
      }
    }
    if (existing) {
      this.releaseRecolor(existing)
      if (!existing.mesh.destroyed) {
        existing.mesh.destroy()
      }
      if (!existing.wrap.destroyed) {
        existing.wrap.destroy({ children: true })
      }
      this.pool.delete(key)
    }
    const { geometry, restPositions } = buildGeometry(leaf)
    geometry.batchMode = 'auto'
    const mesh = new Mesh({ geometry, texture })
    mesh.once('destroyed', () => geometry.destroy(true))
    mesh.eventMode = 'none'
    mesh.roundPixels = false
    mesh.state.cullMode = 'none'
    const wrap = new Container()
    wrap.eventMode = 'none'
    wrap.addChild(mesh)
    const item: PooledMesh = { key, wrap, mesh, restPositions, shader: null }
    this.bindRecolor(item, texture)
    this.pool.set(key, item)
    this.root.addChild(wrap)
    return item
  }

  private bindRecolor(item: PooledMesh, texture: Texture, additive = false): void {
    if (!this.recolorUniforms || (!this.recolor && !additive && !item.shader)) {
      return
    }
    if (!item.shader) {
      item.shader = new ActorRecolorShader(texture, this.recolorUniforms)
      item.mesh.shader = item.shader
      return
    }
    item.shader.texture = texture
  }

  private releaseRecolor(item: PooledMesh): void {
    if (!item.shader) {
      return
    }
    // Drop the leaf texture first: the baked textures are destroyed right
    // after, and a shader still holding one leaks its change listener — the
    // same hazard releaseMeshTexture covers for the adaptor's shared shader.
    item.shader.resources.uTexture = Texture.EMPTY.source
    item.shader.resources.uSampler = Texture.EMPTY.source.style
    if (!item.mesh.destroyed) {
      item.mesh.shader = null
    }
    item.shader.destroy()
    item.shader = null
  }
}

function bakeKey(texture: string, indexedColor: number): string {
  return `${texture}#${indexedColor}`
}

function rgbTint(r: number, g: number, b: number): number {
  const rr = Math.max(0, Math.min(255, Math.round(r * 255)))
  const gg = Math.max(0, Math.min(255, Math.round(g * 255)))
  const bb = Math.max(0, Math.min(255, Math.round(b * 255)))
  return (rr << 16) | (gg << 8) | bb
}

function buildGeometry(leaf: EntityLeaf): { geometry: MeshGeometry; restPositions: Float32Array } {
  const restPositions = new Float32Array(leaf.vertices.length * 2)
  const uvs = new Float32Array(leaf.vertices.length * 2)
  for (let i = 0; i < leaf.vertices.length; i += 1) {
    const vertex = leaf.vertices[i]
    restPositions[i * 2] = vertex.x
    restPositions[i * 2 + 1] = -vertex.y
    uvs[i * 2] = vertex.u
    uvs[i * 2 + 1] = 1 - vertex.v
  }
  return {
    geometry: new MeshGeometry({
      positions: restPositions.slice(),
      uvs,
      indices: Uint32Array.from(leaf.indices),
    }),
    restPositions,
  }
}

function bakeIndexed(base: Texture, mulR: number, mulG: number, mulB: number): Texture {
  const source = base.source.resource as CanvasImageSource | undefined
  const width = base.source.pixelWidth || base.width
  const height = base.source.pixelHeight || base.height
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context || !source) {
    return base
  }
  try {
    context.drawImage(source, 0, 0)
  } catch {
    return base
  }
  const image = context.getImageData(0, 0, width, height)
  const pixels = image.data
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = Math.min(255, pixels[i] * mulR)
    pixels[i + 1] = Math.min(255, pixels[i + 1] * mulG)
    pixels[i + 2] = Math.min(255, pixels[i + 2] * mulB)
  }
  context.putImageData(image, 0, 0)
  const texture = Texture.from(canvas)
  texture.source.scaleMode = 'nearest'
  texture.source.autoGenerateMipmaps = false
  return texture
}
