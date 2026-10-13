import { describe, expect, it } from 'vitest'
import { hasRectArea, isDrawablePolygon, rectPolygon, regularPolygonPoints } from './regions'

describe('rectPolygon', () => {
  it('normalizes corner order', () => {
    expect(rectPolygon(3, 1, 0, 2, 10, 10)).toEqual([
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ])
  })

  it('clips to the map edges', () => {
    expect(rectPolygon(-5, -5, 2, 2, 10, 10)).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 0, y: 3 },
    ])
  })
})

describe('hasRectArea', () => {
  it('is true only for a non-empty axis-aligned rectangle', () => {
    expect(hasRectArea(rectPolygon(0, 0, 1, 1, 10, 10))).toBe(true)
    expect(
      hasRectArea([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 0 },
      ]),
    ).toBe(false)
  })
})

describe('regularPolygonPoints', () => {
  it('builds N evenly spaced vertices at the given radius', () => {
    const points = regularPolygonPoints({ x: 0, y: 0 }, { x: 2, y: 0 }, 4)
    expect(points).toHaveLength(4)
    expect(points[0].x).toBeCloseTo(2)
    expect(points[0].y).toBeCloseTo(0)
    expect(points[1].y).toBeCloseTo(2)
    expect(points[2].x).toBeCloseTo(-2)
  })

  it('returns [] for zero radius or fewer than 3 vertices', () => {
    expect(regularPolygonPoints({ x: 0, y: 0 }, { x: 0, y: 0 }, 6)).toEqual([])
    expect(regularPolygonPoints({ x: 0, y: 0 }, { x: 1, y: 0 }, 2)).toEqual([])
  })
})

describe('isDrawablePolygon', () => {
  it('accepts triangles and larger polygons but rejects segments', () => {
    expect(
      isDrawablePolygon([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]),
    ).toBe(true)
    expect(isDrawablePolygon(regularPolygonPoints({ x: 0, y: 0 }, { x: 1, y: 0 }, 6))).toBe(true)
    expect(
      isDrawablePolygon([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toBe(false)
  })
})
