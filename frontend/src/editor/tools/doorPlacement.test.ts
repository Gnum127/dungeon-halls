import { describe, expect, it } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import { createTerrainRegion } from '../model/regions'
import { createWallSegment } from '../model/wallSegments'
import { distance } from '@/shared/point'
import { DOOR_WALL_DISTANCE, doorEndpoints, MIN_DOOR_LENGTH } from './doorPlacement'
import type { MapModel } from '../model/types'
import type { Point } from '@/shared/point'

const square = (x: number, y: number, size: number): Point[] => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
]

function withWall(): MapModel {
  return applyCommand(createEmptyMap(12, 4), {
    kind: 'setWalls',
    updates: [
      {
        segment: createWallSegment(
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
          ],
          { id: 'w1' },
        ),
        present: true,
      },
    ],
  })
}

/** Г-образная стена: (0,0)→(6,0)→(6,6). */
function withElbowWall(): MapModel {
  return applyCommand(createEmptyMap(12, 12), {
    kind: 'setWalls',
    updates: [
      {
        segment: createWallSegment(
          [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 6 },
          ],
          { id: 'w1' },
        ),
        present: true,
      },
    ],
  })
}

function withCoverage(): MapModel {
  return applyCommand(createEmptyMap(12, 12), {
    kind: 'addRegion',
    region: createTerrainRegion('floor', square(0, 0, 6), 0, 'r'),
  })
}

describe('doorEndpoints', () => {
  it('snaps a free door to the characteristic points of both cells', () => {
    expect(doorEndpoints(createEmptyMap(12, 4), { x: 1.2, y: 1.2 }, { x: 3.7, y: 1.2 })).toEqual({
      a: { x: 1, y: 1 },
      b: { x: 4, y: 1 },
    })
  })

  it('uses the 0.5 nodes of covered cells', () => {
    expect(doorEndpoints(withCoverage(), { x: 1.4, y: 1.4 }, { x: 3.4, y: 3.4 })).toEqual({
      a: { x: 1.5, y: 1.5 },
      b: { x: 3.5, y: 3.5 },
    })
  })

  it('collapses to a zero-length opening when both clicks coincide', () => {
    // Both endpoints use the same snap, so a double click yields a == b.
    expect(doorEndpoints(createEmptyMap(12, 4), { x: 1.3, y: 1.3 }, { x: 1.3, y: 1.3 })).toEqual({
      a: { x: 1, y: 1 },
      b: { x: 1, y: 1 },
    })
  })

  it('runs the door along a wall, rounding the length to 0.5', () => {
    expect(doorEndpoints(withWall(), { x: 4, y: 0 }, { x: 6.2, y: 0 })).toEqual({
      a: { x: 4, y: 0 },
      b: { x: 6, y: 0 },
    })
    expect(doorEndpoints(withWall(), { x: 6, y: 0 }, { x: 3.8, y: 0 })).toEqual({
      a: { x: 6, y: 0 },
      b: { x: 4, y: 0 },
    })
  })

  it('lays the anchor on the wall axis, even off the lattice', () => {
    // Anchor 0.5 above the wall: still aligned, projected onto the axis.
    const { a, b } = doorEndpoints(withWall(), { x: 4, y: DOOR_WALL_DISTANCE }, { x: 6.5, y: 0.5 })
    expect(a).toEqual({ x: 4, y: 0 })
    expect(b).toEqual({ x: 6.5, y: 0 })
  })

  it('keeps a minimum half-cell length along a wall', () => {
    const { a, b } = doorEndpoints(withWall(), { x: 4, y: 0 }, { x: 4.05, y: 0 })
    expect(distance(a, b)).toBe(MIN_DOOR_LENGTH)
  })

  it('picks the segment under the anchor on a multi-segment wall', () => {
    // Anchor near the vertical leg of the elbow: the door runs along x=6.
    expect(doorEndpoints(withElbowWall(), { x: 6, y: 3 }, { x: 6, y: 5.2 })).toEqual({
      a: { x: 6, y: 3 },
      b: { x: 6, y: 5 },
    })
  })

  it('stays free when the first click is not on a wall', () => {
    expect(doorEndpoints(withWall(), { x: 4, y: 1.2 }, { x: 6.7, y: 1.2 })).toEqual({
      a: { x: 4, y: 1 },
      b: { x: 7, y: 1 },
    })
  })
})
