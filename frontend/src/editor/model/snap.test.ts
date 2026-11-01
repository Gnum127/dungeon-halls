import { describe, expect, it } from 'vitest'
import { characteristicPoints, nearestSnapPoint, SNAP_STEP } from './snap'

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
