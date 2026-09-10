/** Dofus 3 `Core.DataCenter.Utils.PatternDecoder`.

    Templates look like `#1{{~1~2 à }}#2 dommages Feu` and
    `-#1{{~1~2 à -}}#2 Force`. Named methods in IL2CPP (`Decode`,
    `FindOptionalDices`, `GetDescription`); the substitution itself is the
    same optional-group language the datacenter has used since Dofus 2. */

const OPTIONAL = /\{\{~(\d+)~(\d+)([^}]*)\}\}/g
const OPTIONAL_SINGLE = /\{~(\d+)~(\d+)([^}]*)\}/g
const PLURAL = /\{\{~ps\}\}/gi
const HASH_BRACED = /\{#(\d+)\}/g
const HASH = /#(\d+)/g
const SPRITE = /<sprite\s+name="[^"]*"\s*\/?>/gi

export type PatternParams = Array<number | string | undefined | null>

export function decodePattern(template: string, params: PatternParams): string {
  const slot = (index: number): string | undefined => {
    const value = params[index - 1]
    if (value == null || value === '') return undefined
    return String(value)
  }
  const first = Number(params.find((value) => value != null && value !== ''))
  const plural = Number.isFinite(first) && Math.abs(first) > 1
  let text = template.replace(SPRITE, '')
  const optionals = (_raw: string, n: string, m: string, body: string) => {
    const left = slot(Number(n))
    const right = slot(Number(m))
    if (left == null || right == null || left === right) return ''
    return body
  }
  text = text.replace(OPTIONAL, optionals)
  text = text.replace(OPTIONAL_SINGLE, optionals)
  text = text.replace(PLURAL, plural ? 's' : '')
  text = text.replace(HASH_BRACED, (_, n) => slot(Number(n)) ?? '')
  text = text.replace(HASH, (_, n) => slot(Number(n)) ?? '')
  return text.replace(/\s{2,}/g, ' ').trim()
}

/** Dice on an `EffectInstance`: one value, or a min–max pair when `diceSide`
    is set. `#3` is the leftover `value` when it is not the only number. */
export function effectPatternParams(effect: {
  diceNum?: number
  diceSide?: number
  value?: number
}): PatternParams {
  const diceNum = effect.diceNum ?? 0
  const diceSide = effect.diceSide ?? 0
  const value = effect.value ?? 0
  if (diceSide !== 0) return [diceNum, diceSide, value || undefined]
  if (diceNum !== 0) return [diceNum, undefined, value || undefined]
  if (value !== 0) return [value, undefined, undefined]
  return []
}
