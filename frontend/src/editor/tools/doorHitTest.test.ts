import { describe, expect, it } from 'vitest'
import { doorHitTest } from './doorHitTest'
import { createWallSegment } from '../model/wallSegments'
import { createDoor } from '../model/doors'

const walls = [
  createWallSegment(
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    { id: 'w1' },
  ),
  createWallSegment(
    [
      { x: 0, y: 5 },
      { x: 10, y: 5 },
    ],
    { id: 'w2' },
  ),
]

describe('doorHitTest', () => {
  const door = createDoor('w1', 0.5, { id: 'd1' })

  it('returns the door id when the point is within the radius', () => {
    expect(doorHitTest({ x: 5, y: 0.05 }, [door], walls, 0.5)).toBe('d1')
  })

  it('returns null when the point is beyond the radius', () => {
    expect(doorHitTest({ x: 5, y: 2 }, [door], walls, 0.5)).toBeNull()
  })

  it('ignores a nearby door that sits on a different wall segment', () => {
    // Вторая стена близко к первой; её дверь в пределах радиуса, но ближайший
    // сегмент к запросу — w1, поэтому фильтр по сегменту обязан вернуть null.
    const closeWalls = [
      walls[0],
      createWallSegment(
        [
          { x: 0, y: 0.3 },
          { x: 10, y: 0.3 },
        ],
        { id: 'w2' },
      ),
    ]
    const other = createDoor('w2', 0.5, { id: 'd2' })
    expect(doorHitTest({ x: 5, y: 0.02 }, [other], closeWalls, 0.5)).toBeNull()
    // Без фильтра по сегменту дверь d2 (расстояние 0.28 < 0.5) была бы найдена.
  })

  it('treats a point exactly at the hit radius as a hit (inclusive boundary)', () => {
    expect(doorHitTest({ x: 5, y: 0.5 }, [door], walls, 0.5)).toBe('d1')
  })

  it('picks the nearest door when several sit on the same segment', () => {
    const near = createDoor('w1', 0.4, { id: 'a' })
    const closest = createDoor('w1', 0.6, { id: 'b' })
    expect(doorHitTest({ x: 5.9, y: 0 }, [near, closest], walls, 2)).toBe('b')
  })

  it('returns null without walls', () => {
    expect(doorHitTest({ x: 0, y: 0 }, [door], [], 1)).toBeNull()
  })
})
