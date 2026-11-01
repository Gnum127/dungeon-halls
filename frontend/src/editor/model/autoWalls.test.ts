import { describe, expect, it } from 'vitest'
import {
  AUTO_WALL_ID_PREFIX,
  computeAutoWalls,
  computeCoverage,
  computeWallsWithRegion,
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

const isClosed = (points: readonly { x: number; y: number }[]) =>
  points.length >= 2 &&
  points[0].x === points[points.length - 1].x &&
  points[0].y === points[points.length - 1].y

const hasEdge = (
  points: readonly { x: number; y: number }[],
  a: { x: number; y: number },
  b: { x: number; y: number },
) =>
  points.some((p, i) => {
    if (i + 1 >= points.length) return false
    const q = points[i + 1]
    return (
      (p.x === a.x && p.y === a.y && q.x === b.x && q.y === b.y) ||
      (p.x === b.x && p.y === b.y && q.x === a.x && q.y === a.y)
    )
  })

describe('computeAutoWalls (one segment per contour)', () => {
  it('returns no walls without solid regions', () => {
    expect(computeAutoWalls([])).toEqual([])
    expect(computeAutoWalls([emptyRegion(1, 1, 1)])).toEqual([])
  })

  it('builds a single closed contour around an interior cell', () => {
    const walls = computeAutoWalls([squareRegion(1, 1, 1)])
    expect(walls).toHaveLength(1)
    const [wall] = walls
    expect(isAutoWallSegmentId(wall.id)).toBe(true)
    expect(wall.points).toHaveLength(5)
    expect(isClosed(wall.points)).toBe(true)
    // Canonical start: the lexicographically smallest vertex — independent of the
    // orientation/starting vertex polygon-clipping returns.
    expect(wall.points[0]).toEqual({ x: 1, y: 1 })
    expect(wall.points).toEqual(
      expect.arrayContaining([
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ]),
    )
  })

  it('canonicalises the contour start independently of the input vertex order', () => {
    // Same square as squareRegion(1, 1, 1) but starting from a non-minimal vertex.
    const shuffled = createTerrainRegion(
      'floor',
      [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
      0,
      'shuffled',
    )
    const walls = computeAutoWalls([shuffled])
    expect(walls).toHaveLength(1)
    // Without canonicalisation the start would stay (2, 2) — the input's first vertex.
    expect(walls[0].points[0]).toEqual({ x: 1, y: 1 })
    // Same contour as the naturally ordered square → identical id.
    expect(idsOf(walls)).toEqual(idsOf(computeAutoWalls([squareRegion(1, 1, 1, 'orig')])))
  })

  it('is invariant to the winding orientation of the input polygon', () => {
    const ccw = createTerrainRegion(
      'floor',
      [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      0,
      'ccw',
    )
    const cw = createTerrainRegion(
      'floor',
      [
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 1 },
      ],
      0,
      'cw',
    )
    const [ccwWall] = computeAutoWalls([ccw])
    const [cwWall] = computeAutoWalls([cw])
    expect(ccwWall.points).toEqual(cwWall.points)
    expect(ccwWall.id).toBe(cwWall.id)
  })

  it('produces identical ids on repeated calls (stable across rebuilds)', () => {
    expect(idsOf(computeAutoWalls([squareRegion(0, 0, 2)]))).toEqual(
      idsOf(computeAutoWalls([squareRegion(0, 0, 2)])),
    )
  })

  it('keeps a single closed contour along the map boundary', () => {
    const walls = computeAutoWalls([squareRegion(0, 0, 10)])
    expect(walls).toHaveLength(1)
    expect(walls[0].points).toHaveLength(5)
    expect(isClosed(walls[0].points)).toBe(true)
  })

  it('merges adjacent solid regions into one contour without an internal seam', () => {
    const walls = computeAutoWalls([squareRegion(0, 0, 2, 'a'), squareRegion(2, 0, 2, 'b')])
    expect(walls).toHaveLength(1)
    // Union is the rectangle 0,0..4,2 → no vertex on the internal seam x=2.
    const seam = walls[0].points.filter((p) => p.x === 2 && p.y !== 0 && p.y !== 2)
    expect(seam).toHaveLength(0)
  })

  it('cuts a separate nested contour for an empty region', () => {
    const walls = computeAutoWalls([squareRegion(0, 0, 4), emptyRegion(1, 1, 2)])
    expect(walls).toHaveLength(2)
    expect(new Set(idsOf(walls)).size).toBe(2)
    expect(walls.every((w) => isClosed(w.points))).toBe(true)
    // one outer contour (4 edges) and one hole contour (4 edges), both 5 points.
    expect(walls.map((w) => w.points.length).sort()).toEqual([5, 5])
    expect(walls.some((w) => hasEdge(w.points, { x: 1, y: 1 }, { x: 3, y: 1 }))).toBe(true)
  })

  it('creates a diagonal contour without stair-stepping for a polygon region', () => {
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
    expect(walls).toHaveLength(1)
    expect(walls[0].points).toHaveLength(4)
    // The hypotenuse is one straight segment (4,0)–(0,4), not many cell steps.
    expect(hasEdge(walls[0].points, { x: 4, y: 0 }, { x: 0, y: 4 })).toBe(true)
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
    const walls = computeAutoWalls([floor, water])
    expect(walls).toHaveLength(1)
    // Offset squares overlap in 1,1..3,3 → union is an 8-vertex contour.
    expect(walls[0].points).toHaveLength(9)
  })

  it('normalises near-identical fractional coordinates to the same contour id', () => {
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
    expect(isAutoWallSegmentId(`${AUTO_WALL_ID_PREFIX}deadbeef`)).toBe(true)
    expect(isAutoWallSegmentId('w1')).toBe(false)
  })
})

describe('computeCoverage (painter order)', () => {
  const region = (
    tileType: 'floor' | 'empty',
    x: number,
    y: number,
    size: number,
    zOrder: number,
    id: string,
  ) =>
    createTerrainRegion(
      tileType,
      [
        { x, y },
        { x: x + size, y },
        { x: x + size, y: y + size },
        { x, y: y + size },
      ],
      zOrder,
      id,
    )

  const ringCount = (coverage: ReturnType<typeof computeCoverage>) =>
    coverage.reduce((total, polygon) => total + polygon.length, 0)

  it('applies regions bottom-up: a higher solid re-adds what a lower empty cut out', () => {
    const regions = [
      region('floor', 0, 0, 6, 0, 'base'),
      region('empty', 1, 1, 4, 1, 'hole'),
      region('floor', 2, 2, 2, 2, 'island'),
    ]
    // shell ring + its hole ring + the island ring that the top solid restored = 3 contours.
    expect(ringCount(computeCoverage(regions))).toBe(3)
    expect(computeAutoWalls(regions)).toHaveLength(3)
  })

  it('repainting over an erased area leaves one solid contour with no interior walls', () => {
    const regions = [
      region('floor', 0, 0, 4, 0, 'base'),
      region('empty', 1, 1, 2, 1, 'hole'),
      region('floor', 1, 1, 2, 2, 'repaint'),
    ]
    expect(ringCount(computeCoverage(regions))).toBe(1)
    const walls = computeAutoWalls(regions)
    expect(walls).toHaveLength(1)
    expect(hasEdge(walls[0].points, { x: 1, y: 1 }, { x: 3, y: 1 })).toBe(false)
  })

  it('does not let a lower empty region erase a higher solid one (top wins)', () => {
    const regions = [region('empty', 0, 0, 4, 0, 'erase'), region('floor', 1, 1, 2, 1, 'island')]
    expect(ringCount(computeCoverage(regions))).toBe(1)
    expect(computeAutoWalls(regions)).toHaveLength(1)
  })

  it('keeps two nested contours (outer boundary + hole) for a solid region with a hole', () => {
    const regions = [region('floor', 0, 0, 6, 0, 'base'), region('empty', 1, 1, 4, 1, 'hole')]
    const coverage = computeCoverage(regions)
    expect(coverage).toHaveLength(1)
    expect(ringCount(coverage)).toBe(2)
    const walls = computeAutoWalls(regions)
    expect(walls).toHaveLength(2)
    expect(walls.some((w) => hasEdge(w.points, { x: 1, y: 1 }, { x: 5, y: 1 }))).toBe(true)
  })

  it('collapses nested contours into one complex contour when the hole is bridged', () => {
    const regions = [
      region('floor', 0, 0, 6, 0, 'base'),
      region('empty', 1, 1, 4, 1, 'hole'),
      region('floor', 1, 1, 6, 2, 'bridge'),
    ]
    // Before the bridge: shell + hole = two rings. After: one complex ring.
    expect(ringCount(computeCoverage(regions.slice(0, 2)))).toBe(2)
    expect(ringCount(computeCoverage(regions))).toBe(1)

    const walls = computeAutoWalls(regions)
    expect(walls).toHaveLength(1)
    // The former hole edges are interior now and must not be walls.
    expect(hasEdge(walls[0].points, { x: 1, y: 1 }, { x: 5, y: 1 })).toBe(false)
    expect(hasEdge(walls[0].points, { x: 1, y: 1 }, { x: 1, y: 5 })).toBe(false)
    expect(isClosed(walls[0].points)).toBe(true)
  })

  it('lets an identical higher empty region erase a lower solid one completely', () => {
    const regions = [region('floor', 0, 0, 4, 0, 'base'), region('empty', 0, 0, 4, 1, 'erase')]
    expect(ringCount(computeCoverage(regions))).toBe(0)
    expect(computeAutoWalls(regions)).toEqual([])
  })

  it('keeps distinct contours for genuinely fractional coordinates', () => {
    const fractional = createTerrainRegion(
      'floor',
      [
        { x: 1.5, y: 1.5 },
        { x: 3.5, y: 1.5 },
        { x: 3.5, y: 3.5 },
        { x: 1.5, y: 3.5 },
      ],
      0,
      'frac',
    )
    const walls = computeAutoWalls([fractional])
    expect(walls).toHaveLength(1)
    expect(hasEdge(walls[0].points, { x: 1.5, y: 1.5 }, { x: 3.5, y: 1.5 })).toBe(true)
    // Stable id across rebuilds, and a distinct contour from a full-cell region.
    expect(idsOf(walls)).toEqual(idsOf(computeAutoWalls([fractional])))
    expect(idsOf(walls)).not.toEqual(idsOf(computeAutoWalls([region('floor', 1, 1, 3, 0, 'int')])))
  })

  it('is deterministic regardless of the order regions were inserted', () => {
    const a = region('floor', 0, 0, 6, 0, 'base')
    const b = region('empty', 1, 1, 4, 1, 'hole')
    expect(idsOf(computeAutoWalls([a, b]))).toEqual(idsOf(computeAutoWalls([b, a])))
  })
})

describe('computeWallsWithRegion (equivalence with full recompute)', () => {
  it('matches a full recompute for a solid preview region', () => {
    const base = [squareRegion(0, 0, 3, 'a')]
    const preview = squareRegion(3, 0, 3, 'p')
    expect(idsOf(computeWallsWithRegion(base, preview))).toEqual(
      idsOf(computeAutoWalls([...base, preview])),
    )
  })

  it('treats an empty preview as a hole (matches full recompute)', () => {
    const base = [squareRegion(0, 0, 4, 'a')]
    const preview = emptyRegion(1, 1, 2, 'p')
    expect(idsOf(computeWallsWithRegion(base, preview))).toEqual(
      idsOf(computeAutoWalls([...base, preview])),
    )
  })

  it('matches a full recompute when a solid preview overlaps an existing hole', () => {
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
    expect(idsOf(computeWallsWithRegion(base, preview))).toEqual(
      idsOf(computeAutoWalls([...base, preview])),
    )
  })

  it('is stable across repeated calls with the same cached base', () => {
    const base = [squareRegion(0, 0, 2, 'a')]
    const preview = squareRegion(2, 0, 2, 'p')
    expect(idsOf(computeWallsWithRegion(base, preview))).toEqual(
      idsOf(computeWallsWithRegion(base, preview)),
    )
  })

  it('handles an empty base', () => {
    const preview = squareRegion(1, 1, 1, 'p')
    expect(idsOf(computeWallsWithRegion([], preview))).toEqual(idsOf(computeAutoWalls([preview])))
  })
})
