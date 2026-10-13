import { describe, expect, it } from 'vitest'
import {
  assertValidDoor,
  createDoor,
  DOOR_POSITION_TOLERANCE,
  doorPlacementConflict,
  doorsOnSegment,
  findDoorById,
  isValidDoor,
  isValidDoorPosition,
} from './doors'
import type { Door } from './doors'
import { createWallSegment } from './wallSegments'

const SEGMENT = createWallSegment(
  [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
  ],
  { id: 'wall-1' },
)

const DOOR: Door = {
  id: 'door-1',
  wallSegmentId: 'wall-1',
  position: 0.5,
  open: false,
  imageId: null,
}

describe('isValidDoorPosition', () => {
  it('accepts [0, 1] boundaries', () => {
    expect(isValidDoorPosition(0)).toBe(true)
    expect(isValidDoorPosition(1)).toBe(true)
    expect(isValidDoorPosition(0.5)).toBe(true)
  })

  it('rejects out-of-range and non-finite', () => {
    expect(isValidDoorPosition(-0.1)).toBe(false)
    expect(isValidDoorPosition(1.1)).toBe(false)
    expect(isValidDoorPosition(NaN)).toBe(false)
    expect(isValidDoorPosition('0.5')).toBe(false)
  })
})

describe('assertValidDoor', () => {
  it('accepts a well-formed door', () => {
    expect(() => assertValidDoor(DOOR)).not.toThrow()
    expect(isValidDoor(DOOR)).toBe(true)
  })

  it('accepts an image-backed door', () => {
    expect(() => assertValidDoor({ ...DOOR, imageId: 'door-wooden' })).not.toThrow()
  })

  it('rejects an empty imageId (must be null or non-empty)', () => {
    expect(() => assertValidDoor({ ...DOOR, imageId: '' })).toThrow(/imageId/)
  })

  it('rejects an out-of-range position', () => {
    expect(() => assertValidDoor({ ...DOOR, position: 2 })).toThrow(/position/)
  })

  it('rejects a non-boolean open', () => {
    expect(() => assertValidDoor({ ...DOOR, open: 'yes' as unknown as boolean })).toThrow(/open/)
  })

  it('rejects an unknown wall segment when segments are provided', () => {
    expect(() => assertValidDoor(DOOR, [SEGMENT])).not.toThrow()
    expect(() => assertValidDoor({ ...DOOR, wallSegmentId: 'missing' }, [SEGMENT])).toThrow(
      /unknown wall segment/,
    )
  })

  it('rejects an empty id', () => {
    expect(() => assertValidDoor({ ...DOOR, id: '' })).toThrow(/id/)
    expect(isValidDoor({ ...DOOR, id: '' })).toBe(false)
  })

  it('rejects an empty wallSegmentId', () => {
    expect(() => assertValidDoor({ ...DOOR, wallSegmentId: '' })).toThrow(/wallSegmentId/)
    expect(isValidDoor({ ...DOOR, wallSegmentId: '' })).toBe(false)
  })

  it('isValidDoor returns false for a non-boolean open', () => {
    expect(isValidDoor({ ...DOOR, open: 1 as unknown as boolean })).toBe(false)
  })
})

describe('createDoor', () => {
  it('creates a closed, texture-less door with a generated id', () => {
    const door = createDoor('wall-1', 0.25)
    expect(door.id.length).toBeGreaterThan(0)
    expect(door).toMatchObject({
      wallSegmentId: 'wall-1',
      position: 0.25,
      open: false,
      imageId: null,
    })
  })

  it('honours explicit options', () => {
    const door = createDoor('wall-1', 0.5, { open: true, imageId: 'door-iron', id: 'fixed' })
    expect(door).toEqual({
      id: 'fixed',
      wallSegmentId: 'wall-1',
      position: 0.5,
      open: true,
      imageId: 'door-iron',
    })
  })

  it('throws for an out-of-range position', () => {
    expect(() => createDoor('wall-1', 1.5)).toThrow(/position/)
  })
})

describe('doorPlacementConflict', () => {
  const existing: Door[] = [{ ...DOOR, position: 0.5 }]

  it('flags a door too close on the same segment', () => {
    expect(doorPlacementConflict(existing, 'wall-1', 0.52)?.id).toBe('door-1')
  })

  it('allows a door farther than the tolerance', () => {
    expect(doorPlacementConflict(existing, 'wall-1', 0.7)).toBeUndefined()
  })

  it('ignores doors on other segments', () => {
    expect(doorPlacementConflict(existing, 'wall-2', 0.5)).toBeUndefined()
  })

  it('ignores the excluded door itself', () => {
    expect(doorPlacementConflict(existing, 'wall-1', 0.5, 'door-1')).toBeUndefined()
  })

  it('uses a strict tolerance boundary (exactly at tolerance is allowed)', () => {
    // Конфликт — строго ближе допуска; ровно на границе конфликта нет.
    expect(doorPlacementConflict(existing, 'wall-1', 0.5 + DOOR_POSITION_TOLERANCE)).toBeUndefined()
    expect(
      doorPlacementConflict(existing, 'wall-1', 0.5 + DOOR_POSITION_TOLERANCE - 1e-6)?.id,
    ).toBe('door-1')
  })
})

describe('findDoorById / doorsOnSegment', () => {
  const doors: Door[] = [
    { ...DOOR, id: 'door-1', position: 0.2 },
    { ...DOOR, id: 'door-2', position: 0.8 },
    { ...DOOR, id: 'door-3', wallSegmentId: 'wall-2', position: 0.5 },
  ]

  it('finds by id', () => {
    expect(findDoorById(doors, 'door-2')?.position).toBe(0.8)
    expect(findDoorById(doors, 'zzz')).toBeUndefined()
  })

  it('lists doors on a segment', () => {
    expect(doorsOnSegment(doors, 'wall-1').map((d) => d.id)).toEqual(['door-1', 'door-2'])
  })

  it('handles empty lists', () => {
    expect(findDoorById([], 'any')).toBeUndefined()
    expect(doorsOnSegment([], 'wall-1')).toEqual([])
  })
})
