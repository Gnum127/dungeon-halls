import { describe, expect, it } from 'vitest'
import { assertValidDoor, createDoor, doorLength, findDoorById, isValidDoor } from './doors'
import type { Door } from './doors'

const DOOR: Door = {
  id: 'door-1',
  a: { x: 1, y: 1 },
  b: { x: 2, y: 1 },
  imageId: null,
}

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

  it('rejects coinciding endpoints', () => {
    expect(() => assertValidDoor({ ...DOOR, b: { x: 1, y: 1 } })).toThrow(/coincide/)
    expect(isValidDoor({ ...DOOR, b: { x: 1, y: 1 } })).toBe(false)
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
  it('creates a texture-less door with a generated id', () => {
    const door = createDoor({ x: 0, y: 0 }, { x: 1, y: 0 })
    expect(door.id.length).toBeGreaterThan(0)
    expect(door).toMatchObject({
      a: { x: 0, y: 0 },
      b: { x: 1, y: 0 },
      imageId: null,
    })
  })

  it('honours explicit options and copies endpoints', () => {
    const a = { x: 1, y: 2 }
    const door = createDoor(a, { x: 3, y: 2 }, { imageId: 'door-iron', id: 'fixed' })
    expect(door).toEqual({
      id: 'fixed',
      a: { x: 1, y: 2 },
      b: { x: 3, y: 2 },
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
