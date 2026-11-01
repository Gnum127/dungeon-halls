import { describe, expect, it } from 'vitest'
import {
  isValidStairsShape,
  MIN_STAIRS_BASE,
  MIN_STAIRS_DEPTH,
  stairsVertices,
} from './stairsPlacement'
import { createStairsPolygon } from '../model/stairs'

describe('stairsVertices', () => {
  it('builds an isosceles trapezoid from the base and the far corner', () => {
    expect(stairsVertices({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 3 })).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 3 },
      { x: 0, y: 3 },
    ])
  })

  it('mirrors the far corner across the perpendicular bisector of the base', () => {
    const [p0, p1, p2, p3] = stairsVertices({ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 2 })
    expect(p0).toEqual({ x: 1, y: 1 })
    expect(p1).toEqual({ x: 3, y: 1 })
    expect(p2).toEqual({ x: 4, y: 2 })
    expect(p3).toEqual({ x: 0, y: 2 })
    // The far edge is parallel to the base.
    expect((p2.x - p3.x) * (p1.y - p0.y) - (p2.y - p3.y) * (p1.x - p0.x)).toBeCloseTo(0)
  })

  it('orders the far pair to keep the contour simple for a near-half click', () => {
    // Click on the near (left) half: the far pair must be swapped (no bowtie).
    const vertices = stairsVertices({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0.5, y: 1 })
    expect(vertices).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1.5, y: 1 },
      { x: 0.5, y: 1 },
    ])
    // The model accepts the produced contour (no RangeError).
    expect(() => createStairsPolygon(vertices)).not.toThrow()
  })

  it('accepts a far click on the far half through the model too', () => {
    const vertices = stairsVertices({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1.5, y: 1 })
    expect(() => createStairsPolygon(vertices)).not.toThrow()
  })

  it('snaps every click to the half grid', () => {
    expect(stairsVertices({ x: 0.2, y: 0.3 }, { x: 2.4, y: 0.4 }, { x: 2.1, y: 3.3 })).toEqual([
      { x: 0, y: 0.5 },
      { x: 2.5, y: 0.5 },
      { x: 2, y: 3.5 },
      { x: 0.5, y: 3.5 },
    ])
  })
})

describe('isValidStairsShape', () => {
  it('accepts a shape with a real base, depth and far edge', () => {
    expect(isValidStairsShape(stairsVertices({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }))).toBe(
      true,
    )
  })

  it('accepts the exact minimum base, depth and far edge', () => {
    const shape = stairsVertices(
      { x: 0, y: 0 },
      { x: MIN_STAIRS_BASE, y: 0 },
      { x: MIN_STAIRS_BASE, y: MIN_STAIRS_DEPTH },
    )
    expect(isValidStairsShape(shape)).toBe(true)
  })

  it('rejects a degenerate base', () => {
    expect(isValidStairsShape(stairsVertices({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 2 }))).toBe(
      false,
    )
  })

  it('rejects a far corner centred on the base (zero far edge)', () => {
    expect(isValidStairsShape(stairsVertices({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }))).toBe(
      false,
    )
  })

  it('rejects a far corner collinear with the base, even beyond its end', () => {
    expect(
      isValidStairsShape([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 4, y: 0 },
        { x: -2, y: 0 },
      ]),
    ).toBe(false)
  })

  it('rejects depth below the minimum (off the lattice)', () => {
    // Perpendicular height to the base line is 0.25 < MIN_STAIRS_DEPTH.
    expect(
      isValidStairsShape([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 0.25 },
        { x: 0, y: 0 },
      ]),
    ).toBe(false)
  })

  it('rejects a wrong vertex count', () => {
    expect(
      isValidStairsShape([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toBe(false)
  })
})
