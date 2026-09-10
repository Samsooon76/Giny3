export function classifyTacticalCells(cells: Array<{ l: number }>): { cellZones: number[]; reachableCells: number[]; unreachableCells: number[] }
export function obstaclePolygons(cell: number, bounds: { left: number; top: number; width: number; bottom: number }, ground: (x: number, y: number) => boolean, obstacle: (x: number, y: number) => boolean): number[][]
export class TacticalRandom { constructor(seed: number); nextIntR(min: number, max: number): number }
export function tacticalCellId(x: number, y: number): number
export function validTacticalPoint(x: number, y: number): boolean
