import { describe, expect, it } from 'vitest'
import { cellCenter, cellCorners, offsetToAxial } from '@/shared/hex'
import { cellCenterAt, hexOrientationOf, mapPixelBounds, visibleCellRange } from './gridGeometry'
import type { Viewport } from './viewport'

describe('hexOrientationOf', () => {
  it('maps hex grid types to their orientation', () => {
    expect(hexOrientationOf('hex-flat')).toBe('flat')
    expect(hexOrientationOf('hex-pointy')).toBe('pointy')
  })

  it('returns null for square', () => {
    expect(hexOrientationOf('square')).toBeNull()
  })
})

describe('mapPixelBounds', () => {
  it('matches the legacy square formula exactly', () => {
    expect(mapPixelBounds(3, 3, 'square', 32)).toEqual({
      width: 96,
      height: 96,
      originX: 0,
      originY: 0,
    })
    expect(mapPixelBounds(300, 10, 'square', 100)).toEqual({
      width: 30000,
      height: 1000,
      originX: 0,
      originY: 0,
    })
  })

  it('adds half a hex beyond the naive w×h·cellSize box', () => {
    const size = 40
    const pointy = mapPixelBounds(5, 4, 'hex-pointy', size)
    expect(pointy.width).toBeCloseTo(Math.sqrt(3) * size * 5.5, 10)
    expect(pointy.height).toBeCloseTo(size * (1.5 * 4 + 0.5), 10)

    const flat = mapPixelBounds(5, 4, 'hex-flat', size)
    expect(flat.width).toBeCloseTo(size * (1.5 * 5 + 0.5), 10)
    expect(flat.height).toBeCloseTo(Math.sqrt(3) * size * 4.5, 10)
  })

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: closed form equals brute-force bounds',
    (gridType) => {
      const size = 24
      const cols = 7
      const rows = 5
      const orientation = hexOrientationOf(gridType)
      if (!orientation) throw new Error(`unexpected non-hex type ${gridType}`)

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const axial = offsetToAxial(col, row, orientation)
          const center = cellCenter(axial.q, axial.r, orientation, size)
          for (const [cx, cy] of cellCorners(orientation, size)) {
            minX = Math.min(minX, center.x + cx)
            minY = Math.min(minY, center.y + cy)
            maxX = Math.max(maxX, center.x + cx)
            maxY = Math.max(maxY, center.y + cy)
          }
        }
      }

      const bounds = mapPixelBounds(cols, rows, gridType, size)
      expect(bounds.width).toBeCloseTo(maxX - minX, 10)
      expect(bounds.height).toBeCloseTo(maxY - minY, 10)
      expect(bounds.originX).toBeCloseTo(minX, 10)
      expect(bounds.originY).toBeCloseTo(minY, 10)
    },
  )

  it.each(['square', 'hex-pointy', 'hex-flat'] as const)(
    '%s: every corner shifted by origin lands inside [0..bounds]',
    (gridType) => {
      const size = 64
      const cols = 6
      const rows = 3
      const bounds = mapPixelBounds(cols, rows, gridType, size)
      const orientation = hexOrientationOf(gridType)
      if (gridType !== 'square' && !orientation) throw new Error(`bad type ${gridType}`)

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const axial =
            orientation === null ? { q: col, r: row } : offsetToAxial(col, row, orientation)
          const center =
            orientation === null
              ? { x: (col + 0.5) * size, y: (row + 0.5) * size }
              : cellCenter(axial.q, axial.r, orientation, size)
          const corners: Array<[number, number]> =
            orientation === null
              ? [
                  [-size / 2, -size / 2],
                  [size / 2, -size / 2],
                  [size / 2, size / 2],
                  [-size / 2, size / 2],
                ]
              : cellCorners(orientation, size)
          for (const [cx, cy] of corners) {
            expect(center.x + cx - bounds.originX).toBeGreaterThanOrEqual(-1e-9)
            expect(center.y + cy - bounds.originY).toBeGreaterThanOrEqual(-1e-9)
            expect(center.x + cx - bounds.originX).toBeLessThanOrEqual(bounds.width + 1e-9)
            expect(center.y + cy - bounds.originY).toBeLessThanOrEqual(bounds.height + 1e-9)
          }
        }
      }
    },
  )
})

describe('visibleCellRange', () => {
  const SIZE = 32

  function viewport(over: Partial<Viewport> = {}): Viewport {
    return { width: 320, height: 240, cellSize: SIZE, offsetX: 0, offsetY: 0, ...over }
  }

  it('square: floor-division ranges clamped to the map', () => {
    expect(visibleCellRange(viewport({ offsetX: 40, offsetY: -10 }), 10, 10, 'square')).toEqual({
      firstCol: 1,
      lastCol: 9,
      firstRow: 0,
      lastRow: 7,
    })
  })

  it('square: column out of range empties columns, rows stay valid', () => {
    const range = visibleCellRange(viewport({ offsetX: 100000 }), 20, 20, 'square')
    expect(range.firstCol).toBeGreaterThan(range.lastCol)
    expect(range.firstRow).toBeLessThanOrEqual(range.lastRow)
  })

  it('square: row before the map empties rows, columns stay valid', () => {
    const range = visibleCellRange(viewport({ offsetY: -50000, offsetX: 64 }), 20, 20, 'square')
    expect(range.firstRow).toBeGreaterThan(range.lastRow)
    expect(range.firstCol).toBeLessThanOrEqual(range.lastCol)
  })

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: covers every cell of a small map at offset 0',
    (gridType) => {
      const range = visibleCellRange(viewport(), 3, 3, gridType)
      expect(range).toEqual({ firstCol: 0, lastCol: 2, firstRow: 0, lastRow: 2 })
    },
  )

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: empty when the viewport sits fully before the map',
    (gridType) => {
      // Ветка hi < 0 в span(): вьюпорт левее/выше карты.
      const range = visibleCellRange(
        viewport({ offsetX: -50000, offsetY: -50000 }),
        20,
        20,
        gridType,
      )
      expect(range.lastCol).toBe(-1)
      expect(range.lastRow).toBe(-1)
    },
  )

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: empty when the viewport is beyond the map end',
    (gridType) => {
      const range = visibleCellRange(
        viewport({ offsetX: 100000, offsetY: 100000, cellSize: 64 }),
        20,
        20,
        gridType,
      )
      expect(range.firstCol).toBeGreaterThan(range.lastCol)
      expect(range.firstRow).toBeGreaterThan(range.lastRow)
    },
  )

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: covers every cell intersecting a mid-map viewport',
    (gridType) => {
      const size = 32
      const cols = 12
      const rows = 12
      const vp: Viewport = { width: 200, height: 160, cellSize: size, offsetX: 150, offsetY: 90 }

      // Брутфорс: клетки, чей полигон пересекает вьюпорт.
      const orientation = gridType === 'hex-pointy' ? 'pointy' : 'flat'
      const corners = cellCorners(orientation, size)
      let minCol = Infinity
      let maxCol = -Infinity
      let minRow = Infinity
      let maxRow = -Infinity
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const center = cellCenterAt(col, row, gridType, size)
          const xs = corners.map(([cx]) => center.x - vp.offsetX + cx)
          const ys = corners.map(([, cy]) => center.y - vp.offsetY + cy)
          if (
            Math.max(...xs) >= 0 &&
            Math.min(...xs) <= vp.width &&
            Math.max(...ys) >= 0 &&
            Math.min(...ys) <= vp.height
          ) {
            minCol = Math.min(minCol, col)
            maxCol = Math.max(maxCol, col)
            minRow = Math.min(minRow, row)
            maxRow = Math.max(maxRow, row)
          }
        }
      }
      expect(minCol).toBeLessThan(Infinity)

      // Диапазон покрывает все пересекающие клетки и не вырождается в карту.
      const range = visibleCellRange(vp, cols, rows, gridType)
      expect(range.firstCol).toBeLessThanOrEqual(minCol)
      expect(range.lastCol).toBeGreaterThanOrEqual(maxCol)
      expect(range.firstRow).toBeLessThanOrEqual(minRow)
      expect(range.lastRow).toBeGreaterThanOrEqual(maxRow)
      expect(range.lastCol - range.firstCol + 1).toBeLessThan(cols)
      expect(range.lastRow - range.firstRow + 1).toBeLessThan(rows)
    },
  )
})
