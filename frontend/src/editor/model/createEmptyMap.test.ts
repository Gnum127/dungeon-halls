import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CELL_SIZE,
  DEFAULT_MAP_HEIGHT,
  DEFAULT_MAP_WIDTH,
  MAX_MAP_SIZE,
} from '@/config/map.config'
import { createEmptyMap } from './createEmptyMap'
import { MAP_VERSION } from './types'

describe('createEmptyMap (v5)', () => {
  it('uses config defaults', () => {
    const model = createEmptyMap()
    expect(model.version).toBe(MAP_VERSION)
    expect(model.grid).toEqual({
      width: DEFAULT_MAP_WIDTH,
      height: DEFAULT_MAP_HEIGHT,
      cellSize: DEFAULT_CELL_SIZE,
    })
    expect(model.regions).toEqual([])
    expect(model.walls).toEqual([])
    expect(model.doors).toEqual([])
    expect(model.objects).toEqual([])
    expect(model.lights).toEqual([])
  })

  it('accepts explicit dimensions and cell size', () => {
    expect(createEmptyMap(10, 20, 32).grid).toEqual({ width: 10, height: 20, cellSize: 32 })
  })

  it.each([0, -1, 1.5, MAX_MAP_SIZE + 1])('rejects invalid width %s', (width) => {
    expect(() => createEmptyMap(width, 10)).toThrow(RangeError)
  })

  it.each([0, -1, 2.5, MAX_MAP_SIZE + 1])('rejects invalid height %s', (height) => {
    expect(() => createEmptyMap(10, height)).toThrow(RangeError)
  })

  it.each([0, -1, NaN, Infinity])('rejects invalid cell size %s', (cellSize) => {
    expect(() => createEmptyMap(10, 10, cellSize)).toThrow(/cell size/i)
  })

  it('accepts the boundary sizes 1 and MAX_MAP_SIZE', () => {
    expect(createEmptyMap(1, 1).grid).toEqual({ width: 1, height: 1, cellSize: DEFAULT_CELL_SIZE })
    expect(createEmptyMap(MAX_MAP_SIZE, MAX_MAP_SIZE).grid.width).toBe(MAX_MAP_SIZE)
  })

  it('mentions MAX_MAP_SIZE in the out-of-range message', () => {
    expect(() => createEmptyMap(MAX_MAP_SIZE + 1, 1)).toThrow(new RegExp(String(MAX_MAP_SIZE)))
  })
})
