export type BubbleSpellStep =
  | { kind: 'parallel'; endPolicy: 'wait-for-all' | 'wait-for-first-one' | 'dont-wait'; steps: BubbleSpellStep[] }
  | { kind: 'set-direction'; targetId: number; cellId: number }
  | { kind: 'native-caster-animation'; sourceId: number; animationName: string; riderAnimationName: string; endPolicy: 'beginning' | 'shot' | 'end' }
  | { kind: 'native-gfx-entity'; sourceId: number; gfxId: number; cellId: number; fromCellId: number; toCellId: number; yOffsetRatio: number; displayMode: number; showUnder: boolean; scaleX: number; scaleY: number; frameOffset: number }
  | { kind: 'missile'; sourceId: number; gfxId: number; fromCellId: number; toCellId: number; speed: number; curvature: number; yOffsetRatio: number; followCurve: boolean }
  | { kind: 'trail'; sourceId: number; gfxId: number; fromCellId: number; toCellId: number; cellIds: number[]; yOffsetRatio: number; displayMode: number; scaleX: number; scaleY: number; showUnder: boolean }
  | { kind: 'staging'; sequenceId: number; intensityMultiplier: number; progression: number; blocking: boolean }
export function nativeSpellPlan(context: { scriptId: number; spellId: number; scriptData: { rawParams: string }; sourceCellId: number; targetCellId: number; spellLevelDef?: { effects: { rawZone?: string; category?: number }[] }; cellsData?: { l: number }[] }): BubbleSpellStep[]
export function trailLineCells(from: number, to: number): number[]
export function missileDuration(from: { x: number; y: number }, to: { x: number; y: number }, speed: number): number
export function missileRotation(from: { x: number; y: number }, to: { x: number; y: number }, curvature: number, progress: number): number
export type BubbleLegacyStep = BubbleSpellStep
  | { kind: 'caster-animation'; sourceId: number; animationName: string; riderAnimationName: string }
  | { kind: 'gfx-entity'; sourceId: number; gfxId: number; cellId: number; fromCellId: number; toCellId: number; yOffsetRatio: number; displayMode: number; showUnder: boolean }
export function legacySpellPlan(context: { scriptId: number; spellId: number; scriptData: { type: number; rawParams: string }; sourceCellId: number; targetCellId: number; spellLevelDef?: { effects: { rawZone?: string; category?: number }[] } }): BubbleLegacyStep[]
