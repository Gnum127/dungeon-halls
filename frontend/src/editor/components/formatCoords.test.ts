import { describe, expect, it } from 'vitest'
import { formatCoords } from './formatCoords'

describe('formatCoords', () => {
  it('formats square offset coordinates', () => {
    expect(formatCoords({ x: 3, y: 7 })).toBe('x: 3 · y: 7')
    expect(formatCoords({ x: 0, y: 0 })).toBe('x: 0 · y: 0')
  })
})
