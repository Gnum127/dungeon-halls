import { describe, expect, it } from 'vitest'
import { isValidStairsShape, stairsVertices } from './stairsPlacement'

describe('stairsVertices', () => {
  it('builds a parallelogram from the base and the far corner', () => {
    expect(stairsVertices({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 3 })).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 3 },
      { x: 0, y: 3 },
    ])
  })

  it('mirrors the far corner across the perpendicular bisector of the base', () => {
    const [p0, p1, p2, p3] = stairsVertices({ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 2 })
    expect(p3).toEqual({ x: p0.x + p2.x - p1.x, y: p0.y + p2.y - p1.y })
    // The far edge is parallel to the base.
    expect({ x: p2.x - p3.x, y: p2.y - p3.y }).toEqual({ x: p1.x - p0.x, y: p1.y - p0.y })
  })

  it('snaps every click to the half grid', () => {
    expect(stairsVertices({ x: 0.2, y: 0.3 }, { x: 2.4, y: 0.1 }, { x: 2.1, y: 3.3 })).toEqual([
      { x: 0, y: 0.5 },
      { x: 2.5, y: 0 },
      { x: 2, y: 3.5 },
      { x: -0.5, y: 4 },
    ])
  })
})

describe('isValidStairsShape', () => {
  it('accepts a shape with a real base and depth', () => {
    expect(isValidStairsShape(stairsVertices({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }))).toBe(
      true,
    )
  })

  it('rejects a degenerate base or depth', () => {
    expect(isValidStairsShape(stairsVertices({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 2 }))).toBe(
      false,
    )
    expect(isValidStairsShape(stairsVertices({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 }))).toBe(
      false,
    )
  })
})
