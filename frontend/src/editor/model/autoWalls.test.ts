import { describe, expect, it } from 'vitest'
import {
  AUTO_WALL_ID_PREFIX,
  computeAutoWalls,
  computePreviewWalls,
  isAutoWallSegmentId,
} from './autoWalls'
import { createTerrainRegion } from './regions'

const squareRegion = (x: number, y: number, size: number, id = 'r') =>
  createTerrainRegion(
    'floor',
    [
      { x, y },
      { x: x + size, y },
      { x: x + size, y: y + size },
      { x, y: y + size },
    ],
    0,
    id,
  )

const emptyRegion = (x: number, y: number, size: number, id = 'e') =>
  createTerrainRegion(
    'empty',
    [
      { x, y },
      { x: x + size, y },
      { x: x + size, y: y + size },
      { x, y: y + size },
    ],
    0,
    id,
  )

const idsOf = (walls: ReturnType<typeof computeAutoWalls>) => walls.map((w) => w.id).sort()

describe('computeAutoWalls', () => {
  it('returns no walls without solid regions', () => {
    expect(computeAutoWalls([])).toEqual([])
    expect(computeAutoWalls([emptyRegion(1, 1, 1)])).toEqual([])
  })

  it('builds an exact contour around an interior cell with deterministic edge ids', () => {
    const walls = computeAutoWalls([squareRegion(1, 1, 1)])
    expect(idsOf(walls)).toEqual([
      'auto:1,1;1,2',
      'auto:1,1;2,1',
      'auto:1,2;2,2',
      'auto:2,1;2,2',
    ])
    expect(walls.every((w) => isAutoWallSegmentId(w.id))).toBe(true)
  })

  it('produces identical ids on repeated calls (stable across rebuilds)', () => {
    const first = idsOf(computeAutoWalls([squareRegion(0, 0, 2)]))
    const second = idsOf(computeAutoWalls([squareRegion(0, 0, 2)]))
    expect(first).toEqual(second)
  })

  it('keeps a closed contour even along the map boundary (no open outer ring)', () => {
    expect(idsOf(computeAutoWalls([squareRegion(0, 0, 10)]))).toEqual([
      'auto:0,0;0,10',
      'auto:0,0;10,0',
      'auto:0,10;10,10',
      'auto:10,0;10,10',
    ])
  })

  it('merges adjacent solid regions and drops the shared edge', () => {
    const walls = computeAutoWalls([squareRegion(0, 0, 2, 'a'), squareRegion(2, 0, 2, 'b')])
    // Union is the rectangle 0,0..4,2 → four outer edges, no wall at x=2.
    expect(walls).toHaveLength(4)
    expect(walls.every((w) => w.points[0].x !== 2 || w.points[1].x !== 2)).toBe(true)
  })

  it('cuts a hole for an empty region (eraser subtracts coverage)', () => {
    const solid = squareRegion(0, 0, 4)
    const hole = emptyRegion(1, 1, 2)
    const walls = computeAutoWalls([solid, hole])
    // Outer square (4 edges) + hole square (4 edges).
    expect(walls).toHaveLength(8)
    expect(idsOf(walls)).toContain('auto:1,1;3,1')
    expect(idsOf(walls)).toContain('auto:1,1;1,3')
  })

  it('creates diagonal walls without stair-stepping for a polygon region', () => {
    const triangle = createTerrainRegion(
      'floor',
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 4 },
      ],
      0,
      't',
    )
    const walls = computeAutoWalls([triangle])
    expect(walls).toHaveLength(3)
    // The hypotenuse is one straight segment (4,0)–(0,4), not many cell steps.
    const hypotenuse = walls.find(
      (w) =>
        (w.points[0].x === 4 && w.points[0].y === 0 && w.points[1].x === 0 && w.points[1].y === 4) ||
        (w.points[0].x === 0 && w.points[0].y === 4 && w.points[1].x === 4 && w.points[1].y === 0),
    )
    expect(hypotenuse).toBeDefined()
  })

  it('unions overlapping regions of different tile types into one contour', () => {
    const floor = squareRegion(0, 0, 3, 'a')
    const water = createTerrainRegion(
      'water',
      [
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 4 },
        { x: 1, y: 4 },
      ],
      1,
      'b',
    )
    // Two offset squares overlap in 1,1..3,3 → union is an 8-edge polygon.
    expect(computeAutoWalls([floor, water])).toHaveLength(8)
  })

  it('normalises near-identical fractional coordinates to the same edge ids', () => {
    const near = (dx: number) =>
      createTerrainRegion(
        'floor',
        [
          { x: 1 + dx, y: 1 },
          { x: 4, y: 1 },
          { x: 4, y: 4 },
          { x: 1 + dx, y: 4 },
        ],
        0,
        'r',
      )
    expect(idsOf(computeAutoWalls([near(0.00001)]))).toEqual(idsOf(computeAutoWalls([near(0)])))
  })
})

describe('isAutoWallSegmentId', () => {
  it('recognizes auto ids and rejects manual ones', () => {
    expect(isAutoWallSegmentId(`${AUTO_WALL_ID_PREFIX}0,0;1,0`)).toBe(true)
    expect(isAutoWallSegmentId('w1')).toBe(false)
  })
})

describe('computePreviewWalls (cached base union)', () => {
  it('matches a full recompute for a solid preview region', () => {
    const base = [squareRegion(0, 0, 3, 'a')]
    const preview = squareRegion(3, 0, 3, 'p')
    expect(idsOf(computePreviewWalls(base, preview))).toEqual(
      idsOf(computeAutoWalls([...base, preview])),
    )
  })

  it('treats an empty preview as a hole (matches full recompute)', () => {
    const base = [squareRegion(0, 0, 4, 'a')]
    const preview = emptyRegion(1, 1, 2, 'p')
    expect(idsOf(computePreviewWalls(base, preview))).toEqual(
      idsOf(computeAutoWalls([...base, preview])),
    )
  })

  it('keeps existing holes when a solid preview overlaps them (matches full recompute)', () => {
    const base = [squareRegion(0, 0, 4, 'a'), emptyRegion(1, 1, 2, 'e')]
    const preview = createTerrainRegion(
      'floor',
      [
        { x: 2, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 2 },
        { x: 2, y: 2 },
      ],
      2,
      'p',
    )
    expect(idsOf(computePreviewWalls(base, preview))).toEqual(
      idsOf(computeAutoWalls([...base, preview])),
    )
  })

  it('is stable across repeated calls with the same cached base', () => {
    const base = [squareRegion(0, 0, 2, 'a')]
    const preview = squareRegion(2, 0, 2, 'p')
    expect(idsOf(computePreviewWalls(base, preview))).toEqual(
      idsOf(computePreviewWalls(base, preview)),
    )
  })

  it('handles an empty base', () => {
    const preview = squareRegion(1, 1, 1, 'p')
    expect(idsOf(computePreviewWalls([], preview))).toEqual(idsOf(computeAutoWalls([preview])))
  })
})
