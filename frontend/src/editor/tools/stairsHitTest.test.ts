import { describe, expect, it } from 'vitest'
import { stairsHitTest } from './stairsHitTest'
import { createStairsPolygon } from '../model/stairs'

const lower = createStairsPolygon(
  [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 2 },
    { x: 0, y: 2 },
  ],
  'lower',
)
const upper = createStairsPolygon(
  [
    { x: 3, y: 1 },
    { x: 6, y: 1 },
    { x: 6, y: 4 },
    { x: 3, y: 4 },
  ],
  'upper',
)

describe('stairsHitTest', () => {
  it('returns the id of the stairs containing the point', () => {
    expect(stairsHitTest({ x: 1, y: 1 }, [lower])).toBe('lower')
  })

  it('prefers the topmost stairs when they overlap', () => {
    expect(stairsHitTest({ x: 3.5, y: 1.5 }, [lower, upper])).toBe('upper')
  })

  it('returns null outside every stairs', () => {
    expect(stairsHitTest({ x: 10, y: 10 }, [lower, upper])).toBeNull()
    expect(stairsHitTest({ x: 0, y: 0 }, [])).toBeNull()
  })
})
