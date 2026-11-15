import { describe, expect, it } from 'vitest'
import { isInsideMap, isWorldPointInsideMap } from './isInsideMap'
import { createEmptyMap } from '../model/createEmptyMap'

describe('isInsideMap', () => {
  const model = createEmptyMap(10, 8)

  it('accepts integer cells inside the grid', () => {
    expect(isInsideMap(model, 0, 0)).toBe(true)
    expect(isInsideMap(model, 9, 7)).toBe(true)
  })

  it('rejects out-of-range, negative and non-integer cells', () => {
    expect(isInsideMap(model, 10, 0)).toBe(false)
    expect(isInsideMap(model, 0, 8)).toBe(false)
    expect(isInsideMap(model, -1, 0)).toBe(false)
    expect(isInsideMap(model, 1.5, 0)).toBe(false)
  })
})

describe('isWorldPointInsideMap', () => {
  const model = createEmptyMap(10, 8)

  it('accepts float points including the far map edge', () => {
    expect(isWorldPointInsideMap(model, 0, 0)).toBe(true)
    expect(isWorldPointInsideMap(model, 1.5, 2.5)).toBe(true)
    expect(isWorldPointInsideMap(model, 10, 8)).toBe(true)
  })

  it('rejects fractional overshoot that snapping would pull back inside', () => {
    // Снап к 0.5 вернул бы 10.2 → 10 и -0.2 → 0 (формально «внутри»), поэтому
    // границы обязаны проверяться до снапа.
    expect(isWorldPointInsideMap(model, 10.2, 0)).toBe(false)
    expect(isWorldPointInsideMap(model, -0.2, 0)).toBe(false)
  })

  it('rejects points beyond the map and non-finite values', () => {
    expect(isWorldPointInsideMap(model, 10.5, 0)).toBe(false)
    expect(isWorldPointInsideMap(model, 0, 8.5)).toBe(false)
    expect(isWorldPointInsideMap(model, -0.5, 0)).toBe(false)
    expect(isWorldPointInsideMap(model, Number.NaN, 0)).toBe(false)
    expect(isWorldPointInsideMap(model, Number.POSITIVE_INFINITY, 0)).toBe(false)
  })
})
