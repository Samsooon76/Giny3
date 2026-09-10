import { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { CellGrid, cellIdToWorld } from '../cells/CellGrid'
import type { WebMapData } from '../maps/types'
import { CameraController, clientToScreen, MAP_FOCUS_OFFSET } from './CameraController'

const BOUNDS = { minX: -600, maxX: 600, minY: -400, maxY: 400 }

function framed(): CameraController {
  const camera = new CameraController(new Container())
  camera.frame(BOUNDS, 1280, 720)
  return camera
}

describe('CameraController', () => {
  it('frames the whole map inside the viewport', () => {
    const camera = framed()
    // 720 / (800 + 2 * 90 margin) is the tighter of the two axes.
    expect(camera.getState().scale).toBeCloseTo(720 / 980, 5)
    const { x, y, scale } = camera.getState()
    expect(x + (BOUNDS.minX - 90) * scale).toBeGreaterThanOrEqual(-0.001)
    // The decorative margin can leave the top edge; playable cells cannot.
    expect(y + BOUNDS.minY * scale).toBeGreaterThanOrEqual(-0.001)
    expect(y).toBeCloseTo(720 * (0.5 - MAP_FOCUS_OFFSET))
    expect(y + (BOUNDS.maxY + 90) * scale).toBeLessThanOrEqual(720.001)
  })

  it('never zooms out past the fitted scale', () => {
    const camera = framed()
    const fit = camera.getState().scale
    for (let index = 0; index < 50; index += 1) camera.zoomAt(640, 360, 1)
    expect(camera.getState().scale).toBeCloseTo(fit, 5)
  })

  it('keeps the viewport inside the map when panning while zoomed in', () => {
    const camera = framed()
    for (let index = 0; index < 10; index += 1) camera.zoomAt(640, 360, -1)
    for (let index = 0; index < 40; index += 1) {
      camera.onPointerDown({ button: 2, clientX: 0, clientY: 0 } as PointerEvent)
      camera.onPointerMove({ clientX: 200, clientY: 200 } as PointerEvent)
      camera.onPointerUp({ button: 2 } as PointerEvent)
    }
    const { x, y, scale } = camera.getState()
    expect(x + (BOUNDS.minX - 90) * scale).toBeLessThanOrEqual(0.001)
    expect(x + (BOUNDS.maxX + 90) * scale).toBeGreaterThanOrEqual(1280 - 0.001)
    expect(y + (BOUNDS.minY - 90) * scale).toBeLessThanOrEqual(-720 * MAP_FOCUS_OFFSET + 0.001)
    expect(y + (BOUNDS.maxY + 90) * scale).toBeGreaterThanOrEqual(720 * (1 - MAP_FOCUS_OFFSET) - 0.001)
  })

  it('zooms in and resets to the framed state', () => {
    const camera = framed()
    const cover = camera.getState()
    camera.zoomAt(640, 360, -1)
    expect(camera.getState().scale).toBeGreaterThan(cover.scale)
    camera.reset()
    expect(camera.getState().scale).toBeCloseTo(cover.scale, 5)
    expect(camera.getState().y).toBeCloseTo(cover.y, 5)
  })

  it('keeps the raised focus and pointer mapping after resize', () => {
    const camera = framed()
    camera.resize(1920, 1080)
    const state = camera.getState()
    expect(state.y).toBeCloseTo(470)
    const target = { x: state.x, y: state.y }
    expect(camera.screenToWorld(target.x, target.y)).toEqual({ x: 0, y: 0 })
    camera.zoomAt(target.x, target.y, -1)
    expect(camera.screenToWorld(target.x, target.y).y).toBeCloseTo(0)
    camera.reset()
    expect(camera.getState()).toEqual(state)
  })
})

it('maps CSS-scaled pointer positions to the same grid cell at every camera zoom', () => {
  const camera = new CameraController(new Container())
  const grid = new CellGrid({ id: 1, cells: Array.from({ length: 560 }, (_, cellId) => {
    const p = cellIdToWorld(cellId)
    return { cellId, x: p.x, y: -p.y, mov: 1, los: 1 }
  }) } as WebMapData)
  const screen = { width: 1280, height: 720 }
  for (const scale of [.5, 1, 2.3]) for (const cssScale of [.75, 1, 1.25]) {
    camera.apply({ x: 400, y: 300, scale })
    const world = grid.cellToWorld(227)
    const rect = { left: 51, top: 87, width: screen.width * cssScale, height: screen.height * cssScale }
    const pointer = { clientX: rect.left + (world.x * scale + 400) * cssScale,
      clientY: rect.top + (world.y * scale + 300) * cssScale }
    const p = clientToScreen(pointer, rect, screen)
    expect(grid.worldToCell(camera.screenToWorld(p.x, p.y))).toBe(227)
    camera.zoomAt(p.x, p.y, -1)
    expect(grid.worldToCell(camera.screenToWorld(p.x, p.y))).toBe(227)
  }
})

it('cancels a pan even when no mouse button is released', () => {
  const camera = framed()
  camera.onPointerDown({ button: 2, clientX: 100, clientY: 100 })
  expect(camera.isPanning).toBe(true)
  camera.onPointerCancel()
  const before = camera.getState()
  expect(camera.onPointerMove({ clientX: 150, clientY: 150 })).toBe(false)
  expect(camera.getState()).toEqual(before)
})
