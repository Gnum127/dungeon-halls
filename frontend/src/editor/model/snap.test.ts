import { describe, expect, it } from 'vitest'
import {
  characteristicPoints,
  nearestSnapPoint,
  snapToCellCharacteristics,
  SNAP_STEP,
} from './snap'
import { applyCommand } from './commands'
import { createEmptyMap } from './createEmptyMap'
import { createTerrainRegion } from './regions'
import type { MapModel } from './types'
import type { Point } from '@/shared/point'

const square = (x: number, y: number, size: number): Point[] => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
]

function coveredModel(): MapModel {
  return applyCommand(createEmptyMap(10, 10), {
    kind: 'addRegion',
    region: createTerrainRegion('floor', square(0, 0, 4), 0, 'r'),
  })
}

describe('characteristicPoints', () => {
  it('returns the 3×3 half-grid nodes for a covered cell', () => {
    const points = characteristicPoints({ x: 2, y: 3 }, true)
    expect(points).toHaveLength(9)
    expect(points).toContainEqual({ x: 2, y: 3 })
    expect(points).toContainEqual({ x: 2 + SNAP_STEP, y: 3 + SNAP_STEP })
    expect(points).toContainEqual({ x: 3, y: 4 })
  })

  it('returns only the four corners for an uncovered cell', () => {
    const points = characteristicPoints({ x: 1, y: 1 }, false)
    expect(points).toHaveLength(4)
    expect(points).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ])
    expect(points).not.toContainEqual({ x: 1.5, y: 1.5 })
  })
})

describe('nearestSnapPoint', () => {
  it('picks the closest point by squared distance', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 5, y: 5 },
    ]
    expect(nearestSnapPoint(points, { x: 0.9, y: 1.1 })).toEqual({ x: 1, y: 1 })
  })

  it('keeps the first candidate on a tie', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]
    expect(nearestSnapPoint(points, { x: 1, y: 0 })).toEqual({ x: 0, y: 0 })
  })

  it('returns null for an empty candidate list', () => {
    expect(nearestSnapPoint([], { x: 0, y: 0 })).toBeNull()
  })
})

describe('snapToCellCharacteristics', () => {
  it('snaps to the nearest half-grid node inside a covered cell', () => {
    expect(snapToCellCharacteristics(coveredModel(), { x: 1.4, y: 1.4 })).toEqual({
      x: 1.5,
      y: 1.5,
    })
    expect(snapToCellCharacteristics(coveredModel(), { x: 1.9, y: 1.9 })).toEqual({ x: 2, y: 2 })
  })

  it('snaps to a corner only when the cell is uncovered', () => {
    expect(snapToCellCharacteristics(coveredModel(), { x: 8.4, y: 8.4 })).toEqual({ x: 8, y: 8 })
    expect(snapToCellCharacteristics(coveredModel(), { x: 8.6, y: 8.4 })).toEqual({ x: 9, y: 8 })
  })

  it('keeps a point already on a characteristic node', () => {
    expect(snapToCellCharacteristics(coveredModel(), { x: 2, y: 3 })).toEqual({ x: 2, y: 3 })
  })
})
