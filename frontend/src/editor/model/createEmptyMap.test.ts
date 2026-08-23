import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './createEmptyMap'
import { EMPTY_TILE, MAX_MAP_DIMENSION } from './types'

describe('createEmptyMap', () => {
  it('creates a map with given dimensions filled with empty tiles', () => {
    const map = createEmptyMap(3, 4)

    expect(map.width).toBe(3)
    expect(map.height).toBe(4)
    expect(map.tiles.length).toBe(12)
    expect([...map.tiles].every((tile) => tile === EMPTY_TILE)).toBe(true)
  })

  it('creates a fresh tiles buffer on every call', () => {
    const first = createEmptyMap(2, 2)
    const second = createEmptyMap(2, 2)

    expect(first.tiles).not.toBe(second.tiles)
  })

  it.each([0, -5, 2.5, Number.NaN, MAX_MAP_DIMENSION + 1])(
    'rejects invalid dimension %s',
    (dimension) => {
      expect(() => createEmptyMap(dimension, 5)).toThrow(RangeError)
      expect(() => createEmptyMap(5, dimension)).toThrow(RangeError)
    },
  )

  it('accepts boundary dimensions', () => {
    expect(() => createEmptyMap(1, 1)).not.toThrow()
    expect(() => createEmptyMap(MAX_MAP_DIMENSION, MAX_MAP_DIMENSION)).not.toThrow()
  })
})
