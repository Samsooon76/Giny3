import { Matrix } from 'pixi.js'
import type { Affine6 } from './types'

export function unityAffineToPixi(transform: Affine6): Matrix {
  const [a, b, tx, c, d, ty] = transform
  return new Matrix(a, -c, -b, d, tx, -ty)
}

export function composeAffine(slot: Affine6, skin: Affine6): Matrix {
  return unityAffineToPixi(slot).append(unityAffineToPixi(skin))
}

/**
 * Apply slot * skin to rest-pose vertices already stored in Pixi space (y flipped).
 * Animator2D affines are general 2x3 matrices, including reflections. Pixi's
 * `setFromMatrix` decomposes into rotation/scale/skew and drops negative
 * scale, which hides connecting body parts on some directions.
 */
export function transformRestPositions(
  slot: Affine6,
  skin: Affine6,
  rest: Float32Array,
  out: Float32Array,
): void {
  const matrix = composeAffine(slot, skin)
  const { a, b, c, d, tx, ty } = matrix
  for (let index = 0; index < rest.length; index += 2) {
    const x = rest[index]
    const y = rest[index + 1]
    out[index] = a * x + c * y + tx
    out[index + 1] = b * x + d * y + ty
  }
}
