import { describe, expect, it } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import { createTerrainRegion } from '../model/regions'
import { createWallSegment } from '../model/wallSegments'
import { doorEndpoints } from './doorPlacement'
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

  it('does NOT snap the door onto a wall — it stays on the cell lattice', () => {
    // Off-lattice start near the wall axis: wall-align would project the anchor
    // onto the axis (4.5,0)→(6.5,0), while the door keeps cell-lattice ends.
    expect(doorEndpoints(withWall(), { x: 4.4, y: 0.3 }, { x: 6.6, y: 0.3 })).toEqual({
      a: { x: 4, y: 0 },
      b: { x: 7, y: 0 },
    })
  })

  it('keeps an arbitrary (non-wall) direction between the two clicks', () => {
    expect(doorEndpoints(withWall(), { x: 4.2, y: 1.2 }, { x: 6.2, y: 3.2 })).toEqual({
      a: { x: 4, y: 1 },
      b: { x: 6, y: 3 },
    })
  })
})
