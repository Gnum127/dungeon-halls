import { describe, expect, it } from 'vitest'
import { axialToOffset, cellCorners, cellCenter, offsetToAxial, pixelToCell } from './hex'
import type { HexOrientation } from './hex'

const ORIENTATIONS: HexOrientation[] = ['flat', 'pointy']
const SIZE = 32

describe('cellCorners', () => {
  it.each(ORIENTATIONS)('%o: produces 6 corners at distance size', (orientation) => {
    const corners = cellCorners(orientation, SIZE)
    expect(corners).toHaveLength(6)
    for (const [x, y] of corners) {
      expect(Math.hypot(x, y)).toBeCloseTo(SIZE, 10)
    }
  })

  it('flat and pointy have different first corners (−30° shift)', () => {
    const flat = cellCorners('flat', SIZE)[0]!
    const pointy = cellCorners('pointy', SIZE)[0]!

    expect(flat[0]).toBeCloseTo(SIZE, 10)
    expect(flat[1]).toBeCloseTo(0, 10)
    expect(pointy[0]).toBeCloseTo(Math.cos(-Math.PI / 6) * SIZE, 6)
    expect(pointy[1]).toBeCloseTo(Math.sin(-Math.PI / 6) * SIZE, 6)
  })
})

describe('pixelToCell + cellCenter roundtrip', () => {
  it.each(ORIENTATIONS)('%o: roundtrip for grid ±5', (orientation) => {
    for (let q = -5; q <= 5; q += 1) {
      for (let r = -5; r <= 5; r += 1) {
        const center = cellCenter(q, r, orientation, SIZE)
        const back = pixelToCell(center.x, center.y, orientation, SIZE)
        expect(back.q).toBe(q)
        expect(back.r).toBe(r)
      }
    }
  })
})

describe('known answers', () => {
  it('pointy center of (1,0) is at (√3·size, 0)', () => {
    const c = cellCenter(1, 0, 'pointy', SIZE)
    expect(c.x).toBeCloseTo(Math.sqrt(3) * SIZE, 10)
    expect(c.y).toBeCloseTo(0, 10)
  })

  it('flat center of (0,1) is at (0, √3·size)', () => {
    const c = cellCenter(0, 1, 'flat', SIZE)
    expect(c.x).toBeCloseTo(0, 10)
    expect(c.y).toBeCloseTo(Math.sqrt(3) * SIZE, 10)
  })
})

describe('offset ↔ axial conversions', () => {
  it.each(ORIENTATIONS)('%o: identity roundtrip over range', (orientation) => {
    for (let col = -4; col <= 4; col += 1) {
      for (let row = -4; row <= 4; row += 1) {
        const axial = offsetToAxial(col, row, orientation)
        const offset = axialToOffset(axial.q, axial.r, orientation)
        expect(offset.col).toBe(col)
        expect(offset.row).toBe(row)
      }
    }
  })

  it('odd-r pointy: row 3 col 0 shifts q by −1', () => {
    const axial = offsetToAxial(0, 3, 'pointy')
    expect(axial.q).toBe(-1)
  })

  it('odd-q flat: col 3 row 0 shifts r by −1', () => {
    const axial = offsetToAxial(3, 0, 'flat')
    expect(axial.r).toBe(-1)
  })
})
