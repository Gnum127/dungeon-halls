import { describe, expect, it } from 'vitest'
import {
  createWallSegment,
  DEFAULT_WALL_THICKNESS,
  findWallSegmentById,
  isWallExtends,
  isValidWallSegment,
  nearestWallSegment,
  pointAlongWallSegment,
  wallSegmentLength,
  wallSegmentPositionOf,
} from './wallSegments'
import type { WallExtends, WallSegment } from './wallSegments'

const LINE = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
]

describe('isWallExtends', () => {
  it.each(['left', 'right', 'both'])('accepts %s', (value) => {
    expect(isWallExtends(value)).toBe(true)
  })

  it('rejects unknown values', () => {
    expect(isWallExtends('center')).toBe(false)
    expect(isWallExtends(42)).toBe(false)
  })
})

describe('createWallSegment / validation', () => {
  it('creates a segment with defaults', () => {
    const segment = createWallSegment(LINE)
    expect(segment.id.length).toBeGreaterThan(0)
    expect(segment.extends).toBe('right')
    expect(segment.thickness).toBe(DEFAULT_WALL_THICKNESS)
    expect(segment.points).toEqual(LINE)
  })

  it('does not alias the source points', () => {
    const source = LINE.map((p) => ({ ...p }))
    const segment = createWallSegment(source)
    expect(segment.points).not.toBe(source)
    expect(segment.points[0]).not.toBe(source[0])
  })

  it('honours explicit options', () => {
    const segment = createWallSegment(LINE, { extends: 'both', thickness: 0, id: 'w1' })
    expect(segment).toMatchObject({ id: 'w1', extends: 'both', thickness: 0 })
  })

  it('throws for fewer than two points', () => {
    expect(() => createWallSegment([{ x: 0, y: 0 }])).toThrow(/2 points/)
  })

  it('throws for negative thickness', () => {
    expect(() => createWallSegment(LINE, { thickness: -1 })).toThrow(/thickness/)
  })

  it('throws for non-finite points', () => {
    expect(() =>
      createWallSegment([
        { x: 0, y: 0 },
        { x: Infinity, y: 0 },
      ]),
    ).toThrow(/finite/)
  })

  it('thickness zero is valid (invisible body / line only)', () => {
    const segment = createWallSegment(LINE, { thickness: 0 })
    expect(isValidWallSegment(segment)).toBe(true)
  })

  it('isValidWallSegment returns false for each invalid field', () => {
    expect(isValidWallSegment({ ...createWallSegment(LINE), id: '' })).toBe(false)
    expect(isValidWallSegment({ ...createWallSegment(LINE), points: [{ x: 0, y: 0 }] })).toBe(false)
    expect(
      isValidWallSegment({
        ...createWallSegment(LINE),
        points: [
          { x: NaN, y: 0 },
          { x: 1, y: 0 },
        ],
      }),
    ).toBe(false)
    expect(
      isValidWallSegment({ ...createWallSegment(LINE), extends: 'center' as WallExtends }),
    ).toBe(false)
    expect(isValidWallSegment({ ...createWallSegment(LINE), thickness: -0.1 })).toBe(false)
    expect(isValidWallSegment({ ...createWallSegment(LINE), thickness: NaN })).toBe(false)
  })

  it('throws for an unknown extends value', () => {
    expect(() => createWallSegment(LINE, { extends: 'center' as WallExtends })).toThrow(/extends/)
  })

  it('throws for non-finite thickness', () => {
    expect(() => createWallSegment(LINE, { thickness: NaN })).toThrow(/thickness/)
    expect(() => createWallSegment(LINE, { thickness: Infinity })).toThrow(/thickness/)
  })

  it('throws for an empty explicit id', () => {
    expect(() => createWallSegment(LINE, { id: '' })).toThrow(/id/)
  })
})

describe('wallSegmentLength', () => {
  it('sums segment lengths of a polyline', () => {
    const segment = createWallSegment([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 4 },
    ])
    expect(wallSegmentLength(segment)).toBeCloseTo(7)
  })

  it('ignores zero-length subsegments (duplicate points)', () => {
    const segment = createWallSegment([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ])
    expect(wallSegmentLength(segment)).toBeCloseTo(3)
  })
})

describe('findWallSegmentById', () => {
  const segments: WallSegment[] = [
    createWallSegment(LINE, { id: 'a' }),
    createWallSegment(LINE, { id: 'b' }),
  ]

  it('finds by id', () => {
    expect(findWallSegmentById(segments, 'b')?.id).toBe('b')
  })

  it('returns undefined for a missing id', () => {
    expect(findWallSegmentById(segments, 'zzz')).toBeUndefined()
  })
})

describe('nearestWallSegment', () => {
  const segments: WallSegment[] = [
    createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      { id: 'horizontal' },
    ),
    createWallSegment(
      [
        { x: 0, y: 5 },
        { x: 0, y: 10 },
      ],
      { id: 'vertical' },
    ),
  ]

  it('picks the closest segment and projects the point', () => {
    const hit = nearestWallSegment(segments, { x: 5, y: 1 })
    expect(hit?.segment.id).toBe('horizontal')
    expect(hit?.point).toEqual({ x: 5, y: 0 })
    expect(hit?.t).toBeCloseTo(0.5)
  })

  it('returns undefined for an empty list', () => {
    expect(nearestWallSegment([], { x: 0, y: 0 })).toBeUndefined()
  })

  it('selects the correct polyline segment index', () => {
    const polyline = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 },
      ],
      { id: 'poly' },
    )
    const hit = nearestWallSegment([polyline], { x: 4, y: 4 })
    expect(hit?.index).toBe(1)
  })

  it('reports the distance to the axis line', () => {
    const hit = nearestWallSegment(segments, { x: 5, y: 2 })
    expect(hit?.segment.id).toBe('horizontal')
    expect(hit?.distance).toBeCloseTo(2)
  })
})

describe('pointAlongWallSegment / wallSegmentPositionOf', () => {
  const straight = createWallSegment(
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    { id: 'straight' },
  )

  const polyline = createWallSegment(
    [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 4 },
    ],
    { id: 'poly' },
  )

  it('interpolates along a straight segment', () => {
    expect(pointAlongWallSegment(straight, 0)).toEqual({ x: 0, y: 0 })
    expect(pointAlongWallSegment(straight, 1)).toEqual({ x: 10, y: 0 })
    expect(pointAlongWallSegment(straight, 0.25)).toEqual({ x: 2.5, y: 0 })
  })

  it('clamps out-of-range positions', () => {
    expect(pointAlongWallSegment(straight, -1)).toEqual({ x: 0, y: 0 })
    expect(pointAlongWallSegment(straight, 2)).toEqual({ x: 10, y: 0 })
  })

  it('follows a polyline by arc length (corner at 3/7)', () => {
    // Полная длина 7: доля 3/7 — на углу (3, 0).
    const corner = pointAlongWallSegment(polyline, 3 / 7)
    expect(corner.x).toBeCloseTo(3)
    expect(corner.y).toBeCloseTo(0)
    expect(pointAlongWallSegment(polyline, 1)).toEqual({ x: 3, y: 4 })
  })

  it('is inverse to wallSegmentPositionOf along a polyline', () => {
    const position = wallSegmentPositionOf(polyline, { x: 3, y: 2 })
    expect(position).toBeCloseTo(5 / 7)
    const point = pointAlongWallSegment(polyline, position)
    expect(point.x).toBeCloseTo(3)
    expect(point.y).toBeCloseTo(2)
  })

  it('handles a degenerate (zero-length) segment', () => {
    const degenerate = createWallSegment(
      [
        { x: 4, y: 4 },
        { x: 4, y: 4 },
      ],
      { id: 'zero' },
    )
    expect(pointAlongWallSegment(degenerate, 0.5)).toEqual({ x: 4, y: 4 })
    expect(wallSegmentPositionOf(degenerate, { x: 0, y: 0 })).toBe(0)
  })
})
