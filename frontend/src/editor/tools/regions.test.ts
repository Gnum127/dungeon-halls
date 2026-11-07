import { describe, expect, it } from 'vitest'
import {
  clampPolygonToGrid,
  hasPolygonArea,
  hasRectArea,
  isCommittablePolygon,
  isDrawablePolygon,
  polygonArea,
  rectPolygon,
  regularPolygonPoints,
} from './regions'

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

  it('clamps every vertex inside map bounds when bounds are given', () => {
    const points = regularPolygonPoints({ x: 0.5, y: 0.5 }, { x: 4, y: 4 }, 4, {
      cols: 4,
      rows: 4,
    })
    expect(points.length).toBeGreaterThanOrEqual(3)
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(4)
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThanOrEqual(4)
    }
  })
})

describe('clampPolygonToGrid', () => {
  it('clips each vertex to the map bounds', () => {
    expect(
      clampPolygonToGrid(
        [
          { x: -2, y: -1 },
          { x: 5, y: 1 },
          { x: 2, y: 9 },
        ],
        4,
        4,
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 1 },
      { x: 2, y: 4 },
    ])
  })

  it('collapses consecutive vertices that stick together after clamping', () => {
    expect(
      clampPolygonToGrid(
        [
          { x: -1, y: 0 },
          { x: -2, y: 0 },
          { x: 3, y: 0 },
        ],
        4,
        4,
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ])
  })

  it('collapses a wrap-around duplicate (first === last after clamping)', () => {
    expect(
      clampPolygonToGrid(
        [
          { x: -1, y: -1 },
          { x: 2, y: 0 },
          { x: -3, y: -4 },
        ],
        4,
        4,
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ])
  })
})

describe('polygonArea / hasPolygonArea', () => {
  it('computes a sensible area and detects degenerate polygons', () => {
    expect(
      polygonArea([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ]),
    ).toBeCloseTo(4)
    expect(
      hasPolygonArea([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ]),
    ).toBe(true)
    // Collapsed to a point / a line.
    expect(
      hasPolygonArea([
        { x: 1, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ]),
    ).toBe(false)
    expect(
      hasPolygonArea([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
    ).toBe(false)
  })
})

describe('isCommittablePolygon', () => {
  it('accepts a real polygon and rejects degenerate or self-intersecting ones', () => {
    expect(
      isCommittablePolygon([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
      ]),
    ).toBe(true)
    // All vertices coincide (clamped away entirely) → no-op upstream.
    expect(
      isCommittablePolygon([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]),
    ).toBe(false)
    // Bow-tie: vertices cross.
    expect(
      isCommittablePolygon([
        { x: 0, y: 0 },
        { x: 2, y: 2 },
        { x: 2, y: 0 },
        { x: 0, y: 2 },
      ]),
    ).toBe(false)
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
