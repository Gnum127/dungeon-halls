import { describe, expect, it } from 'vitest'
import { formatCoords } from './formatCoords'
import { axialToOffset } from '@/shared/hex'
import type { GridType } from '@/shared/tiles'

describe('formatCoords', () => {
  it('formats square grids as offset x/y', () => {
    expect(formatCoords({ x: 0, y: 0 }, 'square')).toBe('x: 0 · y: 0')
    expect(formatCoords({ x: 12, y: 7 }, 'square')).toBe('x: 12 · y: 7')
  })

  it('formats pointy-top hexes as odd-r axial q/r', () => {
    // odd-r: q = x − (y − (y&1))/2, r = y
    expect(formatCoords({ x: 3, y: 2 }, 'hex-pointy')).toBe('q: 2 · r: 2')
    expect(formatCoords({ x: 4, y: 3 }, 'hex-pointy')).toBe('q: 3 · r: 3')
    expect(formatCoords({ x: 0, y: 0 }, 'hex-pointy')).toBe('q: 0 · r: 0')
  })

  it('formats flat-top hexes as odd-q axial q/r', () => {
    // odd-q: q = x, r = y − (x − (x&1))/2
    expect(formatCoords({ x: 3, y: 4 }, 'hex-flat')).toBe('q: 3 · r: 3')
    expect(formatCoords({ x: 2, y: 5 }, 'hex-flat')).toBe('q: 2 · r: 4')
    expect(formatCoords({ x: 0, y: 0 }, 'hex-flat')).toBe('q: 0 · r: 0')
  })

  it('round-trips every cell of a sample map through the shared conversions', () => {
    for (const gridType of ['hex-pointy', 'hex-flat'] as const) {
      const orientation = gridType === 'hex-pointy' ? 'pointy' : 'flat'
      for (let y = 0; y < 6; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const formatted = formatCoords({ x, y }, gridType satisfies GridType)
          const [qs, rs] = formatted.replace('q: ', '').split(' · r: ')
          const back = axialToOffset(Number(qs), Number(rs), orientation)
          expect(back).toEqual({ col: x, row: y })
        }
      }
    }
  })
})
