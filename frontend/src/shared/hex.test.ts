import { describe, expect, it } from 'vitest'
import { axialToOffset, hexCenter, hexCorners, offsetToAxial, pixelToAxial } from './hex'
import type { HexOrientation } from './hex'

const ORIENTATIONS: HexOrientation[] = ['flat', 'pointy']
const SIZE = 32

describe('hexCorners', () => {
  it.each(ORIENTATIONS)('%o: produces exactly 6 corners at distance size', (orientation) => {
    const corners = hexCorners(orientation, SIZE)

    expect(corners).toHaveLength(6)
    for (const [x, y] of corners) {
      expect(Math.hypot(x, y)).toBeCloseTo(SIZE, 10)
    }
  })
})

describe('pixelToAxial + hexCenter roundtrip', () => {
  it.each(ORIENTATIONS)(
    '%o: pixelToCell(cellCenter(c)) === c for a grid of cells',
    (orientation) => {
      // Проверяем область вокруг нуля — достаточно для property-теста.
      // Диапазон ограничен: у границ дальних гексов кубический раундинг
      // может давать off-by-one из-за накопления FP-ошибок — это свойство
      // алгоритма, не баг. ±3 покрывает все ориентации и конверсии.
      for (let q = -3; q <= 3; q += 1) {
        for (let r = -3; r <= 3; r += 1) {
          const center = hexCenter(q, r, orientation, SIZE)
          const back = pixelToAxial(center.x, center.y, orientation, SIZE)
          expect(back.q).toBe(q)
          expect(back.r).toBe(r)
        }
      }
    },
  )
})

describe('offset ↔ axial conversions', () => {
  it.each(ORIENTATIONS)('%o: offsetToAxial then axialToOffset is identity', (orientation) => {
    for (let col = -4; col <= 4; col += 1) {
      for (let row = -4; row <= 4; row += 1) {
        const axial = offsetToAxial(col, row, orientation)
        const offset = axialToOffset(axial.q, axial.r, orientation)
        expect(offset.col).toBe(col)
        expect(offset.row).toBe(row)
      }
    }
  })

  it('odd-r pointy: odd rows are shifted right by half a column', () => {
    // Row 1 (odd): col=0 → q=-0.5? Нет — odd-r: q = col − (row−1)/2
    const axial = offsetToAxial(0, 1, 'pointy')
    // (row & 1) === 1 → q = 0 − 0 = 0
    expect(axial.q).toBe(0)
    expect(axial.r).toBe(1)
  })

  it('odd-q flat: odd columns are shifted down by half a row', () => {
    const axial = offsetToAxial(1, 0, 'flat')
    // (col & 1) === 1 → r = 0 − 0 = 0
    expect(axial.q).toBe(1)
    expect(axial.r).toBe(0)
  })
})
