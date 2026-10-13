import { describe, expect, it } from 'vitest'
import {
  assertValidRegion,
  createTerrainRegion,
  isValidPolygon,
  isValidRegion,
  nextZOrder,
  polygonSelfIntersects,
  regionBounds,
  segmentsIntersect,
} from './regions'
import type { TerrainRegion } from './regions'

const SQUARE = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 },
]

const BOWTIE = [
  { x: 0, y: 0 },
  { x: 4, y: 4 },
  { x: 4, y: 0 },
  { x: 0, y: 4 },
]

describe('segmentsIntersect', () => {
  it('detects a crossing', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 4, y: 0 })).toBe(
      true,
    )
  })

  it('detects disjoint segments', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 2 }, { x: 1, y: 2 })).toBe(
      false,
    )
  })

  it('treats touching collinear endpoints as intersecting', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 })).toBe(
      true,
    )
  })

  it('detects a T-touch (vertex on the interior of another segment)', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 3 })).toBe(
      true,
    )
  })

  it('detects collinear overlapping segments', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 0 }, { x: 6, y: 0 })).toBe(
      true,
    )
  })

  it('reports parallel disjoint segments as not intersecting', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 1 }, { x: 4, y: 1 })).toBe(
      false,
    )
  })
})

describe('polygonSelfIntersects', () => {
  it('is false for a simple square', () => {
    expect(polygonSelfIntersects(SQUARE)).toBe(false)
  })

  it('is true for a bowtie', () => {
    expect(polygonSelfIntersects(BOWTIE)).toBe(true)
  })

  it('is false for fewer than four points', () => {
    expect(
      polygonSelfIntersects([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 0 },
      ]),
    ).toBe(false)
  })

  it('detects a T-touch where a vertex lies on a non-adjacent edge', () => {
    const tTouch = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 2, y: 0 },
      { x: 0, y: 4 },
    ]
    expect(polygonSelfIntersects(tTouch)).toBe(true)
  })

  it('treats duplicated consecutive vertices as self-intersection (degenerate edge)', () => {
    const duplicated = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 4 },
    ]
    expect(polygonSelfIntersects(duplicated)).toBe(true)
  })

  it('treats a repeated closing vertex as self-intersection', () => {
    const closed = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
      { x: 0, y: 0 },
    ]
    expect(polygonSelfIntersects(closed)).toBe(true)
  })
})

describe('isValidPolygon', () => {
  it('accepts a triangle and a square', () => {
    expect(
      isValidPolygon([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]),
    ).toBe(true)
    expect(isValidPolygon(SQUARE)).toBe(true)
  })

  it('rejects fewer than three vertices', () => {
    expect(
      isValidPolygon([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toBe(false)
  })

  it('rejects non-finite coordinates', () => {
    expect(
      isValidPolygon([
        { x: 0, y: 0 },
        { x: NaN, y: 0 },
        { x: 0, y: 1 },
      ]),
    ).toBe(false)
  })

  it('rejects self-intersecting polygons', () => {
    expect(isValidPolygon(BOWTIE)).toBe(false)
  })
})

describe('createTerrainRegion / assertValidRegion', () => {
  it('creates a valid region with a generated id', () => {
    const region = createTerrainRegion('floor', SQUARE, 0)
    expect(region.id.length).toBeGreaterThan(0)
    expect(region.tileType).toBe('floor')
    expect(region.zOrder).toBe(0)
    expect(region.polygon).toEqual(SQUARE)
  })

  it('does not alias the source polygon', () => {
    const source = SQUARE.map((p) => ({ ...p }))
    const region = createTerrainRegion('grass', source, 1, 'fixed')
    expect(region.polygon).not.toBe(source)
    expect(region.polygon[0]).not.toBe(source[0])
  })

  it('honours an explicit id', () => {
    expect(createTerrainRegion('water', SQUARE, 0, 'fixed').id).toBe('fixed')
  })

  it('throws for an unknown tile type', () => {
    expect(() =>
      createTerrainRegion('lava' as unknown as TerrainRegion['tileType'], SQUARE, 0),
    ).toThrow(RangeError)
  })

  it('throws for a self-intersecting polygon', () => {
    expect(() => createTerrainRegion('floor', BOWTIE, 0)).toThrow(/self-intersect/)
  })

  it('throws for fewer than three vertices', () => {
    expect(() => createTerrainRegion('floor', [{ x: 0, y: 0 }], 0)).toThrow(/3 vertices/)
  })

  it('throws for a negative zOrder', () => {
    const region: TerrainRegion = { id: 'a', tileType: 'floor', polygon: SQUARE, zOrder: -1 }
    expect(() => assertValidRegion(region)).toThrow(/zOrder/)
    expect(isValidRegion(region)).toBe(false)
  })

  it('throws for a non-integer zOrder', () => {
    const region: TerrainRegion = { id: 'a', tileType: 'floor', polygon: SQUARE, zOrder: 1.5 }
    expect(() => assertValidRegion(region)).toThrow(/zOrder/)
    expect(isValidRegion(region)).toBe(false)
  })

  it('throws for non-finite vertices through the factory validator', () => {
    expect(() =>
      createTerrainRegion(
        'floor',
        [
          { x: 0, y: 0 },
          { x: NaN, y: 0 },
          { x: 0, y: 1 },
        ],
        0,
      ),
    ).toThrow(/finite/)
    expect(() =>
      createTerrainRegion(
        'floor',
        [
          { x: 0, y: 0 },
          { x: Infinity, y: 0 },
          { x: 0, y: 1 },
        ],
        0,
      ),
    ).toThrow(/finite/)
  })

  it('throws for an empty id', () => {
    expect(() => createTerrainRegion('floor', SQUARE, 0, '')).toThrow(/id/)
  })

  it('throws RangeError (not TypeError) for a non-array polygon', () => {
    const broken = {
      id: 'a',
      tileType: 'floor',
      polygon: undefined as unknown as TerrainRegion['polygon'],
      zOrder: 0,
    } satisfies TerrainRegion
    expect(() => assertValidRegion(broken)).toThrow(RangeError)
    expect(isValidRegion(broken)).toBe(false)
  })
})

describe('nextZOrder', () => {
  it('is 0 for an empty list', () => {
    expect(nextZOrder([])).toBe(0)
  })

  it('is max + 1', () => {
    const regions: TerrainRegion[] = [
      { id: 'a', tileType: 'floor', polygon: SQUARE, zOrder: 2 },
      { id: 'b', tileType: 'grass', polygon: SQUARE, zOrder: 5 },
    ]
    expect(nextZOrder(regions)).toBe(6)
  })
})

describe('regionBounds', () => {
  it('computes the bounding box', () => {
    expect(regionBounds({ id: 'a', tileType: 'floor', polygon: SQUARE, zOrder: 0 })).toEqual({
      minX: 0,
      minY: 0,
      maxX: 4,
      maxY: 4,
    })
  })

  it('handles negative coordinates', () => {
    const region: TerrainRegion = {
      id: 'a',
      tileType: 'floor',
      polygon: [
        { x: -1, y: -2 },
        { x: 3, y: -2 },
        { x: 3, y: 2 },
        { x: -1, y: 2 },
      ],
      zOrder: 0,
    }
    expect(regionBounds(region)).toEqual({ minX: -1, minY: -2, maxX: 3, maxY: 2 })
  })

  it('handles a degenerate (single-point) polygon', () => {
    const region: TerrainRegion = {
      id: 'a',
      tileType: 'floor',
      polygon: [{ x: 2, y: 5 }],
      zOrder: 0,
    }
    expect(regionBounds(region)).toEqual({ minX: 2, minY: 5, maxX: 2, maxY: 5 })
  })
})
