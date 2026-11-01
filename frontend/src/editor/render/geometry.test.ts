import { describe, expect, it } from 'vitest'
import { DOOR_GAP_CLEARANCE, splitWallByDoorGaps, stairsStepSegments, wallRuns } from './geometry'
import { createWallSegment } from '../model/wallSegments'
import type { Point } from '@/shared/point'

interface Gap {
  a: Point
  b: Point
}

const line = (ax: number, ay: number, bx: number, by: number): Point[] => [
  { x: ax, y: ay },
  { x: bx, y: by },
]

const gap = (ax: number, ay: number, bx: number, by: number): Gap => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
})

function round(points: Point[][]): { x: number; y: number }[][] {
  return points.map((run) =>
    run.map((p) => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 })),
  )
}

describe('splitWallByDoorGaps', () => {
  it('keeps the whole polyline when there are no doors', () => {
    const points = line(0, 0, 10, 0)
    expect(splitWallByDoorGaps(points, [], DOOR_GAP_CLEARANCE)).toEqual([points])
  })

  it('cuts the door interval plus clearance on each side', () => {
    const runs = splitWallByDoorGaps(line(0, 0, 10, 0), [gap(4, 0, 5, 0)], DOOR_GAP_CLEARANCE)

    expect(round(runs)).toEqual([
      [
        { x: 0, y: 0 },
        { x: 3.833, y: 0 },
      ],
      [
        { x: 5.167, y: 0 },
        { x: 10, y: 0 },
      ],
    ])
  })

  it('merges two doors whose gaps overlap into one opening', () => {
    const runs = splitWallByDoorGaps(
      line(0, 0, 10, 0),
      [gap(2, 0, 3, 0), gap(3.1, 0, 4, 0)],
      DOOR_GAP_CLEARANCE,
    )
    expect(round(runs)).toEqual([
      [
        { x: 0, y: 0 },
        { x: 1.833, y: 0 },
      ],
      [
        { x: 4.167, y: 0 },
        { x: 10, y: 0 },
      ],
    ])
  })

  it('keeps two separate openings for non-overlapping doors', () => {
    const runs = splitWallByDoorGaps(
      line(0, 0, 10, 0),
      [gap(1, 0, 2, 0), gap(5, 0, 6, 0)],
      DOOR_GAP_CLEARANCE,
    )
    expect(runs).toHaveLength(3)
    expect(round(runs)).toEqual([
      [
        { x: 0, y: 0 },
        { x: 0.833, y: 0 },
      ],
      [
        { x: 2.167, y: 0 },
        { x: 4.833, y: 0 },
      ],
      [
        { x: 6.167, y: 0 },
        { x: 10, y: 0 },
      ],
    ])
  })

  it('ignores a door that does not lie on the wall', () => {
    expect(splitWallByDoorGaps(line(0, 0, 10, 0), [gap(4, 2, 5, 2)], DOOR_GAP_CLEARANCE)).toEqual([
      line(0, 0, 10, 0),
    ])
  })

  it('ignores a collinear door entirely past the wall end', () => {
    expect(splitWallByDoorGaps(line(0, 0, 10, 0), [gap(12, 0, 13, 0)], DOOR_GAP_CLEARANCE)).toEqual(
      [line(0, 0, 10, 0)],
    )
  })

  it('clamps a door interval that runs past the wall end', () => {
    const runs = splitWallByDoorGaps(line(0, 0, 10, 0), [gap(9, 0, 12, 0)], DOOR_GAP_CLEARANCE)
    expect(round(runs)).toEqual([
      [
        { x: 0, y: 0 },
        { x: 8.833, y: 0 },
      ],
    ])
  })

  it('clamps a door interval that starts before the wall', () => {
    const runs = splitWallByDoorGaps(line(0, 0, 10, 0), [gap(-2, 0, 3, 0)], DOOR_GAP_CLEARANCE)
    expect(round(runs)).toEqual([
      [
        { x: 3.167, y: 0 },
        { x: 10, y: 0 },
      ],
    ])
  })

  it('returns nothing when the opening spans the whole wall', () => {
    expect(splitWallByDoorGaps(line(0, 0, 4, 0), [gap(0, 0, 4, 0)], 2)).toEqual([])
  })

  it('ignores a degenerate edge', () => {
    expect(splitWallByDoorGaps(line(0, 0, 0, 0), [gap(0, 0, 1, 0)], DOOR_GAP_CLEARANCE)).toEqual([])
  })
})

describe('stairsStepSegments', () => {
  const rectangle = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 3 },
    { x: 0, y: 3 },
  ]

  it('draws steps perpendicular to the axis, across the base midpoint', () => {
    const steps = stairsStepSegments(rectangle)
    // Axis base midpoint (1,0) → far midpoint (1,3); 0.25 spacing → 13 steps.
    expect(steps).toHaveLength(13)

    for (const { a, b } of steps) {
      // Steps are horizontal (perpendicular to the vertical axis)…
      expect(a.y).toBeCloseTo(b.y)
      // …and their midpoint lies on the axis x = 1.
      expect((a.x + b.x) / 2).toBeCloseTo(1)
    }
    expect(steps[0].a.y).toBeCloseTo(0)
    expect(steps[1].a.y).toBeCloseTo(0.25)
  })

  it('falls back to bounding-box rows for non-rectangular polygons', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 2 },
    ]
    const steps = stairsStepSegments(triangle)
    expect(steps.length).toBeGreaterThan(0)
    for (const { a, b } of steps) {
      expect(a.y).toBeCloseTo(b.y)
      expect(a.x).toBeCloseTo(0)
      expect(b.x).toBeCloseTo(2)
    }
  })
})

describe('wallRuns', () => {
  it('leaves a closed ring whole (returns to the start point)', () => {
    const wall = createWallSegment(
      line(0, 0, 4, 0).concat({ x: 4, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 0 }),
    )
    const runs = wallRuns(wall, [], DOOR_GAP_CLEARANCE)
    expect(runs).toHaveLength(1)
    expect(runs[0][0]).toEqual(runs[0][runs[0].length - 1])
  })

  it('opens a cut closed ring as one run between the two gap edges', () => {
    const wall = createWallSegment(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
        { x: 0, y: 0 },
      ],
      { id: 'w1' },
    )
    const runs = wallRuns(wall, [gap(1.5, 0, 2.5, 0)], DOOR_GAP_CLEARANCE)

    expect(runs).toHaveLength(1)
    expect(round(runs)).toEqual([
      [
        { x: 2.667, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
        { x: 0, y: 0 },
        { x: 1.333, y: 0 },
      ],
    ])
  })
})
