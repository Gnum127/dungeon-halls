import { describe, expect, it } from 'vitest'
import { hashFromCoords, pickIndexFromCoords } from './random'

describe('hashFromCoords', () => {
  it('is deterministic for the same coordinates', () => {
    expect(hashFromCoords(3, 7)).toBe(hashFromCoords(3, 7))
    expect(hashFromCoords(-2, 5)).toBe(hashFromCoords(-2, 5))
  })

  it('returns a non-negative 32-bit integer', () => {
    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [123, 456],
      [-9, -9],
    ]) {
      const value = hashFromCoords(x, y)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(0xffffffff)
    }
  })

  it('varies across neighbouring coordinates', () => {
    expect(hashFromCoords(1, 0)).not.toBe(hashFromCoords(0, 0))
    expect(hashFromCoords(0, 1)).not.toBe(hashFromCoords(0, 0))
  })

  it('tolerates float coordinates by truncating', () => {
    expect(hashFromCoords(3.9, 7.2)).toBe(hashFromCoords(3, 7))
  })
})

describe('pickIndexFromCoords', () => {
  it('stays within [0, poolSize)', () => {
    for (let x = 0; x < 20; x += 1) {
      for (let y = 0; y < 20; y += 1) {
        const index = pickIndexFromCoords(x, y, 4)
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(4)
      }
    }
  })

  it('is deterministic', () => {
    expect(pickIndexFromCoords(5, 9, 4)).toBe(pickIndexFromCoords(5, 9, 4))
  })

  it('covers all pool variants across a region', () => {
    const seen = new Set<number>()
    for (let x = 0; x < 16; x += 1) {
      for (let y = 0; y < 16; y += 1) {
        seen.add(pickIndexFromCoords(x, y, 4))
      }
    }
    expect(seen.size).toBe(4)
  })

  it('throws for a non-positive pool size', () => {
    expect(() => pickIndexFromCoords(0, 0, 0)).toThrow(RangeError)
    expect(() => pickIndexFromCoords(0, 0, 2.5)).toThrow(RangeError)
  })
})
