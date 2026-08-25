import { describe, expect, it } from 'vitest'
import { cellCenterAt } from './gridGeometry'
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
    expect(screenToCell(vp(), 10, 10, 'square')).toEqual({ x: 0, y: 0 })
    expect(screenToCell(vp(), 40, 70, 'square')).toEqual({ x: 1, y: 2 })
  })

  it('accounts for zoom (cellSize ≠ base)', () => {
    expect(screenToCell(vp({ cellSize: 16 }), 40, 40, 'square')).toEqual({ x: 2, y: 2 })
    expect(screenToCell(vp({ cellSize: 64 }), 40, 40, 'square')).toEqual({ x: 0, y: 0 })
  })

  it('accounts for scroll offset in both axes', () => {
    const scrolled = vp({ offsetX: 96, offsetY: 64 })
    expect(screenToCell(scrolled, 0, 0, 'square')).toEqual({ x: 3, y: 2 })
    expect(screenToCell(scrolled, 32, 32, 'square')).toEqual({ x: 4, y: 3 })
  })

  it('combines zoom and scroll and may return cells outside the map', () => {
    const combined = vp({ cellSize: 16, offsetX: 100, offsetY: -48 })
    expect(screenToCell(combined, 20, 20, 'square')).toEqual({ x: 7, y: -2 })
  })

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: round-trips the center of every cell across viewports',
    (gridType) => {
      // Зум ≠ 32 и ненулевые (в т.ч. отрицательные) offset: потеря
      // origin-сдвига или ошибка масштабирования ломают round-trip.
      const viewports: Viewport[] = [
        vp({ cellSize: 32 }),
        vp({ cellSize: 16, offsetX: 96, offsetY: -64 }),
        vp({ cellSize: 64 }),
        vp({ cellSize: 20, offsetX: -50, offsetY: 70 }),
      ]
      for (const viewport of viewports) {
        for (let row = 0; row < 6; row += 1) {
          for (let col = 0; col < 6; col += 1) {
            const center = cellCenterAt(col, row, gridType, viewport.cellSize)
            const cell = screenToCell(
              viewport,
              center.x - viewport.offsetX,
              center.y - viewport.offsetY,
              gridType,
            )
            expect(cell).toEqual({ x: col, y: row })
          }
        }
      }
    },
  )

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: keeps off-center points inside their hex',
    (gridType) => {
      const size = 32
      // Точки внутри гекса, но не в центре: сдвиги меньше апофемы (√3/2·s)
      // и половины размера — сбой cube-round на границе здесь виден.
      const center = cellCenterAt(2, 3, gridType, size)
      const offsets: Array<[number, number]> = [
        [0.4 * size, 0],
        [-0.4 * size, 0],
        [0, 0.4 * size],
        [0, -0.4 * size],
        [0.25 * size, 0.25 * size],
      ]
      for (const [dx, dy] of offsets) {
        const cell = screenToCell(vp({ cellSize: size }), center.x + dx, center.y + dy, gridType)
        expect(cell).toEqual({ x: 2, y: 3 })
      }
    },
  )

  it('hex-pointy: returns cells outside the map for far points', () => {
    const size = 32
    // Cube-round не должен «заворачивать» далёкие точки внутрь карты.
    const topLeft = screenToCell(vp({ cellSize: size }), -1000, -1000, 'hex-pointy')
    expect(topLeft.x).toBeLessThanOrEqual(-1)
    expect(topLeft.y).toBeLessThanOrEqual(-1)

    const bottomRight = screenToCell(vp({ cellSize: size }), 5000, 5000, 'hex-pointy')
    expect(bottomRight.x).toBeGreaterThanOrEqual(8)
    expect(bottomRight.y).toBeGreaterThanOrEqual(8)
  })

  it('hex-pointy: resolves the shifted odd row to its own column', () => {
    const size = 32
    // Центр клетки (1,3): нечётный ряд смещён на полгекса по x — hit-test
    // обязан вернуть его колонку, а не колонку чётного ряда.
    const oddRow = cellCenterAt(1, 3, 'hex-pointy', size)
    expect(screenToCell(vp({ cellSize: size }), oddRow.x, oddRow.y, 'hex-pointy')).toEqual({
      x: 1,
      y: 3,
    })
  })
})

describe('zoomAt', () => {
  it('keeps the world point under the cursor anchored', () => {
    const before = vp({ cellSize: 32, offsetX: 50, offsetY: 30 })
    const sx = 120
    const sy = 90

    const after = zoomAt(before, sx, sy, 64)

    const beforeCell = screenToCell(before, sx, sy, 'square')
    const afterCell = screenToCell(after, sx, sy, 'square')
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
