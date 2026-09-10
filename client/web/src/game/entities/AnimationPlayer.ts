import type { EntityAnimation, EntityFrameNode, WebEntityData } from './types'

export class AnimationPlayer {
  private entity: WebEntityData | null = null
  animationName = ''
  frameIndex = 0
  looping = true
  playing = false
  private accum = 0

  setup(entity: WebEntityData): void {
    this.entity = entity
  }

  clear(): void { this.entity = null; this.playing = false }

  hasAnimation(name: string): boolean {
    return this.entity?.animations[name] != null
  }

  current(): EntityAnimation | null {
    if (!this.entity) {
      return null
    }
    return this.entity.animations[this.animationName] ?? null
  }

  nodes(): EntityFrameNode[] {
    const animation = this.current()
    if (!animation) {
      return []
    }
    return animation.frames[this.frameIndex] ?? []
  }

  play(name: string, loop = true, reset = true): void {
    if (!this.hasAnimation(name)) {
      return
    }
    const changed = this.animationName !== name
    this.animationName = name
    this.looping = loop
    this.playing = true
    if (reset || changed) {
      this.frameIndex = 0
      this.accum = 0
    }
  }

  tick(deltaSeconds: number): boolean {
    if (!this.playing || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return false
    }
    const animation = this.current()
    if (!animation || !animation.frames.length) {
      return false
    }
    const frameRate = Math.max(1, animation.frameRate || this.entity?.frameRate || 25)
    this.accum += deltaSeconds
    const frameTime = 1 / frameRate
    const steps = Math.floor(this.accum / frameTime)
    if (!steps) return false
    this.accum %= frameTime
    const previous = this.frameIndex
    const next = previous + steps
    const count = animation.frames.length
    this.frameIndex = this.looping ? next % count : Math.min(next, count - 1)
    if (!this.looping && next >= count) this.playing = false
    return previous !== this.frameIndex
  }
}
