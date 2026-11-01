import { describe, expect, it } from 'vitest'
import {
  assertValidDoor,
  createDoor,
  cycleDoorOpenAngle,
  DEFAULT_DOOR_OPEN_ANGLE,
  doorLeafEnd,
  doorLength,
  findDoorById,
  isValidDoor,
  isValidDoorOpenAngle,
  MAX_DOOR_OPEN_ANGLE,
} from './doors'
import type { Door } from './doors'

const DOOR: Door = {
  id: 'door-1',
  a: { x: 1, y: 1 },
  b: { x: 2, y: 1 },
  openAngle: 0,
  imageId: null,
}

describe('isValidDoorOpenAngle', () => {
  it('accepts the closed state and both bounds', () => {
    expect(isValidDoorOpenAngle(0)).toBe(true)
    expect(isValidDoorOpenAngle(30)).toBe(true)
    expect(isValidDoorOpenAngle(-MAX_DOOR_OPEN_ANGLE)).toBe(true)
    expect(isValidDoorOpenAngle(MAX_DOOR_OPEN_ANGLE)).toBe(true)
  })

  it('rejects out-of-range and non-finite', () => {
    expect(isValidDoorOpenAngle(MAX_DOOR_OPEN_ANGLE + 0.1)).toBe(false)
    expect(isValidDoorOpenAngle(-MAX_DOOR_OPEN_ANGLE - 0.1)).toBe(false)
    expect(isValidDoorOpenAngle(NaN)).toBe(false)
    expect(isValidDoorOpenAngle('30')).toBe(false)
  })
})

describe('assertValidDoor', () => {
  it('accepts a well-formed door', () => {
    expect(() => assertValidDoor(DOOR)).not.toThrow()
    expect(isValidDoor(DOOR)).toBe(true)
  })

  it('accepts an image-backed, open door', () => {
    expect(() => assertValidDoor({ ...DOOR, imageId: 'door-wooden', openAngle: -30 })).not.toThrow()
  })

  it('rejects an empty imageId (must be null or non-empty)', () => {
    expect(() => assertValidDoor({ ...DOOR, imageId: '' })).toThrow(/imageId/)
  })

  it('rejects coinciding endpoints', () => {
    expect(() => assertValidDoor({ ...DOOR, b: { x: 1, y: 1 } })).toThrow(/coincide/)
    expect(isValidDoor({ ...DOOR, b: { x: 1, y: 1 } })).toBe(false)
  })

  it('rejects an out-of-range openAngle', () => {
    expect(() => assertValidDoor({ ...DOOR, openAngle: 200 })).toThrow(/openAngle/)
    expect(isValidDoor({ ...DOOR, openAngle: 200 })).toBe(false)
  })

  it('rejects non-finite endpoints', () => {
    expect(isValidDoor({ ...DOOR, a: { x: NaN, y: 1 } })).toBe(false)
  })

  it('rejects an empty id', () => {
    expect(() => assertValidDoor({ ...DOOR, id: '' })).toThrow(/id/)
    expect(isValidDoor({ ...DOOR, id: '' })).toBe(false)
  })
})

describe('createDoor', () => {
  it('creates a closed, texture-less door with a generated id', () => {
    const door = createDoor({ x: 0, y: 0 }, { x: 1, y: 0 })
    expect(door.id.length).toBeGreaterThan(0)
    expect(door).toMatchObject({
      a: { x: 0, y: 0 },
      b: { x: 1, y: 0 },
      openAngle: 0,
      imageId: null,
    })
  })

  it('honours explicit options and copies endpoints', () => {
    const a = { x: 1, y: 2 }
    const door = createDoor(
      a,
      { x: 3, y: 2 },
      { openAngle: -30, imageId: 'door-iron', id: 'fixed' },
    )
    expect(door).toEqual({
      id: 'fixed',
      a: { x: 1, y: 2 },
      b: { x: 3, y: 2 },
      openAngle: -30,
      imageId: 'door-iron',
    })
    expect(door.a).not.toBe(a)
  })

  it('throws for coinciding endpoints', () => {
    expect(() => createDoor({ x: 1, y: 1 }, { x: 1, y: 1 })).toThrow(/coincide/)
  })
})

describe('door geometry', () => {
  it('reports the opening length', () => {
    expect(doorLength(DOOR)).toBe(1)
  })

  it('keeps b as the leaf end when closed', () => {
    expect(doorLeafEnd(DOOR)).toEqual({ x: 2, y: 1 })
  })

  it('rotates the leaf around the hinge a by openAngle', () => {
    // 90° rotation of (1, 0) around (1, 1) → (1, 2).
    expect(doorLeafEnd({ ...DOOR, openAngle: 90 })).toEqual({ x: 1, y: 2 })
    // −90° goes the other side.
    expect(doorLeafEnd({ ...DOOR, openAngle: -90 })).toEqual({ x: 1, y: 0 })
  })

  it('preserves the leaf length under rotation', () => {
    const rotated = doorLeafEnd({ ...DOOR, openAngle: 45 })
    expect(Math.hypot(rotated.x - DOOR.a.x, rotated.y - DOOR.a.y)).toBeCloseTo(1, 10)
  })
})

describe('cycleDoorOpenAngle (+A → −A → 0 → +A)', () => {
  it('cycles through the three states', () => {
    expect(cycleDoorOpenAngle(0)).toBe(DEFAULT_DOOR_OPEN_ANGLE)
    expect(cycleDoorOpenAngle(DEFAULT_DOOR_OPEN_ANGLE)).toBe(-DEFAULT_DOOR_OPEN_ANGLE)
    expect(cycleDoorOpenAngle(-DEFAULT_DOOR_OPEN_ANGLE)).toBe(0)
  })

  it('honours a custom step', () => {
    expect(cycleDoorOpenAngle(0, 45)).toBe(45)
    expect(cycleDoorOpenAngle(45, 45)).toBe(-45)
  })
})

describe('findDoorById', () => {
  const doors: Door[] = [
    { ...DOOR, id: 'door-1' },
    { ...DOOR, id: 'door-2', b: { x: 4, y: 1 } },
  ]

  it('finds by id', () => {
    expect(findDoorById(doors, 'door-2')?.b.x).toBe(4)
    expect(findDoorById(doors, 'zzz')).toBeUndefined()
  })

  it('handles an empty list', () => {
    expect(findDoorById([], 'any')).toBeUndefined()
  })
})
