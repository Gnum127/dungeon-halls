import { describe, expect, it } from 'vitest'
import { isInsideMap } from './isInsideMap'
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
