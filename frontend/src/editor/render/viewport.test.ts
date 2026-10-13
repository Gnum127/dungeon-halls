import { describe, expect, it } from 'vitest'
import { cellCenterAt } from './geometry'
import {
  BASE_CELL_SIZE,
  MAX_CELL_SIZE,
  MIN_CELL_SIZE,
  clampCellSize,
  screenToCell,
  zoomAt,
} from './viewport'
import type { Viewport } from './viewport'

function vp(overrides: Partial<Viewport> = {}): Viewport {
  return { width: 320, height: 240, cellSize: BASE_CELL_SIZE, offsetX: 0, offsetY: 0, ...overrides }
}

describe('clampCellSize', () => {
  it('keeps size within bounds', () => {
    expect(clampCellSize(BASE_CELL_SIZE)).toBe(BASE_CELL_SIZE)
    expect(clampCellSize(MIN_CELL_SIZE - 1)).toBe(MIN_CELL_SIZE)
    expect(clampCellSize(MAX_CELL_SIZE + 50)).toBe(MAX_CELL_SIZE)
  })

  it('falls back to base size for NaN and Infinity', () => {
    expect(clampCellSize(Number.NaN)).toBe(BASE_CELL_SIZE)
    expect(clampCellSize(Number.POSITIVE_INFINITY)).toBe(BASE_CELL_SIZE)
  })
})

describe('screenToCell', () => {
  it('maps identity viewport to cell coordinates', () => {
    expect(screenToCell(vp(), 10, 10)).toEqual({ x: 0, y: 0 })
    expect(screenToCell(vp(), 40, 70)).toEqual({ x: 1, y: 2 })
  })

  it('accounts for zoom (cellSize ≠ base)', () => {
    expect(screenToCell(vp({ cellSize: 16 }), 40, 40)).toEqual({ x: 2, y: 2 })
    expect(screenToCell(vp({ cellSize: 64 }), 40, 40)).toEqual({ x: 0, y: 0 })
  })

  it('accounts for scroll offset in both axes', () => {
    const scrolled = vp({ offsetX: 96, offsetY: 64 })
    expect(screenToCell(scrolled, 0, 0)).toEqual({ x: 3, y: 2 })
    expect(screenToCell(scrolled, 32, 32)).toEqual({ x: 4, y: 3 })
  })

  it('combines zoom and scroll and may return cells outside the map', () => {
    const combined = vp({ cellSize: 16, offsetX: 100, offsetY: -48 })
    expect(screenToCell(combined, 20, 20)).toEqual({ x: 7, y: -2 })
  })

  it('round-trips the center of every cell across viewports', () => {
    const viewports: Viewport[] = [
      vp({ cellSize: 32 }),
      vp({ cellSize: 16, offsetX: 96, offsetY: -64 }),
      vp({ cellSize: 64 }),
      vp({ cellSize: 20, offsetX: -50, offsetY: 70 }),
    ]
    for (const viewport of viewports) {
      for (let row = 0; row < 6; row += 1) {
        for (let col = 0; col < 6; col += 1) {
          const center = cellCenterAt(col, row, viewport.cellSize)
          const cell = screenToCell(viewport, center.x - viewport.offsetX, center.y - viewport.offsetY)
          expect(cell).toEqual({ x: col, y: row })
        }
      }
    }
  })
})

describe('zoomAt', () => {
  it('keeps the world point under the cursor anchored', () => {
    const before = vp({ cellSize: 32, offsetX: 50, offsetY: 30 })
    const sx = 120
    const sy = 90

    const after = zoomAt(before, sx, sy, 64)

    const beforeCell = screenToCell(before, sx, sy)
    const afterCell = screenToCell(after, sx, sy)
    expect(afterCell.x).toBe(beforeCell.x)
    expect(afterCell.y).toBe(beforeCell.y)
  })

  it('clamps the resulting cell size', () => {
    const result = zoomAt(vp(), 0, 0, 9999)
    expect(result.cellSize).toBe(MAX_CELL_SIZE)

    const shrunk = zoomAt(vp(), 0, 0, 1)
    expect(shrunk.cellSize).toBe(MIN_CELL_SIZE)
  })
})
