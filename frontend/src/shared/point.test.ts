import { describe, expect, it } from 'vitest'
import {
  distance,
  isFinitePoint,
  lerpPoint,
  pointInPolygon,
  pointsEqual,
  pointToSegmentDistance,
  projectOnSegment,
  signedPolygonArea,
} from './point'

describe('isFinitePoint', () => {
  it('accepts finite numeric points', () => {
    expect(isFinitePoint({ x: 0, y: 0 })).toBe(true)
    expect(isFinitePoint({ x: -3.5, y: 12 })).toBe(true)
  })

  it('rejects non-finite coordinates', () => {
    expect(isFinitePoint({ x: NaN, y: 0 })).toBe(false)
    expect(isFinitePoint({ x: 0, y: Infinity })).toBe(false)
  })

  it('rejects non-point values', () => {
    expect(isFinitePoint(null)).toBe(false)
    expect(isFinitePoint('0,0')).toBe(false)
    expect(isFinitePoint({ x: '0', y: 0 })).toBe(false)
  })
})

describe('point helpers', () => {
  it('pointsEqual compares with tolerance', () => {
    expect(pointsEqual({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true)
    expect(pointsEqual({ x: 1, y: 2 }, { x: 1.0000000001, y: 2 })).toBe(true)
    expect(pointsEqual({ x: 1, y: 2 }, { x: 1.5, y: 2 })).toBe(false)
  })

  it('lerpPoint interpolates between endpoints', () => {
    expect(lerpPoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 0)).toEqual({ x: 0, y: 0 })
    expect(lerpPoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 1)).toEqual({ x: 10, y: 20 })
    expect(lerpPoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5)).toEqual({ x: 5, y: 10 })
  })

  it('distance computes euclidean length', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('distance between identical points is zero', () => {
    expect(distance({ x: 7, y: -2 }, { x: 7, y: -2 })).toBe(0)
  })

  it('projectOnSegment clamps to [0, 1]', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 10, y: 0 }
    expect(projectOnSegment({ x: 5, y: 3 }, a, b).t).toBeCloseTo(0.5)
    expect(projectOnSegment({ x: -5, y: 0 }, a, b).t).toBe(0)
    expect(projectOnSegment({ x: 20, y: 0 }, a, b).t).toBe(1)
  })

  it('projectOnSegment handles degenerate (zero-length) segments', () => {
    const a = { x: 2, y: 2 }
    expect(projectOnSegment({ x: 9, y: 9 }, a, a)).toEqual({ point: { x: 2, y: 2 }, t: 0 })
  })

  it('pointToSegmentDistance returns perpendicular distance', () => {
    expect(pointToSegmentDistance({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3)
    expect(pointToSegmentDistance({ x: -4, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(4)
  })

  it('signedPolygonArea sign depends on winding', () => {
    const ccw = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ]
    // CCW → положительная площадь (конкретное значение, не только |area|).
    expect(signedPolygonArea(ccw)).toBeCloseTo(16)
    expect(signedPolygonArea([...ccw].reverse())).toBeCloseTo(-16)
  })

  it('pointInPolygon detects inside/outside', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ]
    expect(pointInPolygon({ x: 2, y: 2 }, square)).toBe(true)
    expect(pointInPolygon({ x: 5, y: 2 }, square)).toBe(false)
    expect(pointInPolygon({ x: 2, y: -1 }, square)).toBe(false)
  })

  it('pointInPolygon treats the boundary as inside (edges and vertices)', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ]
    expect(pointInPolygon({ x: 2, y: 0 }, square)).toBe(true)
    expect(pointInPolygon({ x: 2, y: 4 }, square)).toBe(true)
    expect(pointInPolygon({ x: 0, y: 2 }, square)).toBe(true)
    expect(pointInPolygon({ x: 4, y: 2 }, square)).toBe(true)
    expect(pointInPolygon({ x: 0, y: 0 }, square)).toBe(true)
    expect(pointInPolygon({ x: 4, y: 4 }, square)).toBe(true)
  })
})
