/** Source: Bubble app-CgRsD63L.js, Db / Lb / v7, movement preview palette.
 * Rounded diamonds use the same 0.92 scale, 0.08 corner and 3 curve steps. */
export const BUBBLE = {
  reachable: 0x41a515, tackle: 0xff8c00, blocked: 0x660000,
  tackleBorder: 0xffc738, blockedBorder: 0xff2e2e,
  grid: 0x666666, hover: 0xffffff,
}
export function roundedCell(x: number, y: number, scale = .92): number[] {
  const corners = [[x, y - 21.5 * scale], [x + 43 * scale, y], [x, y + 21.5 * scale], [x - 43 * scale, y]]
  const result: number[] = []
  for (let i = 0; i < 4; i++) {
    const p = corners[i], before = corners[(i + 3) % 4], after = corners[(i + 1) % 4]
    const a = p.map((v, j) => v + (before[j] - v) * .08), b = p.map((v, j) => v + (after[j] - v) * .08)
    result.push(...a)
    for (let n = 1; n <= 3; n++) { const t = n / 3; result.push((1-t)**2*a[0]+2*(1-t)*t*p[0]+t*t*b[0], (1-t)**2*a[1]+2*(1-t)*t*p[1]+t*t*b[1]) }
  }
  return result
}
