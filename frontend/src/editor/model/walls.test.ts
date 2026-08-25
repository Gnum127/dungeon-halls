import { describe, expect, it } from 'vitest'
import {
  edgeKey,
  hasWall,
  isCanonical,
  isEdgeInBounds,
  normalizeEdge,
} from './walls'
import type { WallEdge } from './walls'

describe('normalizeEdge', () => {
  it.each([
    [{ x: 0, y: 0, side: 'E' }, 4, 4, { x: 1, y: 0, side: 'W' }],
    [{ x: 0, y: 0, side: 'S' }, 4, 4, { x: 0, y: 1, side: 'N' }],
    // Периметр: соседней клетки нет — ребро хранится как есть.
    [{ x: 3, y: 1, side: 'E' }, 4, 4, { x: 3, y: 1, side: 'E' }],
    [{ x: 1, y: 3, side: 'S' }, 4, 4, { x: 1, y: 3, side: 'S' }],
    [{ x: 2, y: 2, side: 'N' }, 4, 4, { x: 2, y: 2, side: 'N' }],
    [{ x: 2, y: 2, side: 'W' }, 4, 4, { x: 2, y: 2, side: 'W' }],
  ] as Array<[WallEdge, number, number, WallEdge]>)(
    'normalizes %j to %j',
    (edge, width, height, expected) => {
      expect(normalizeEdge(edge, width, height)).toEqual(expected)
    },
  )

  it('is idempotent', () => {
    const edge = normalizeEdge({ x: 2, y: 1, side: 'E' }, 5, 5)
    expect(normalizeEdge(edge, 5, 5)).toEqual(edge)
  })
})

describe('edge helpers', () => {
  it('keys identical edges identically', () => {
    expect(edgeKey({ x: 1, y: 2, side: 'W' })).toBe('1,2,W')
    expect(edgeKey({ x: 1, y: 2, side: 'N' })).not.toBe(edgeKey({ x: 1, y: 2, side: 'W' }))
  })

  it('bounds check requires the edge cell to exist', () => {
    expect(isEdgeInBounds({ x: 3, y: 3, side: 'E' }, 4, 4)).toBe(true)
    expect(isEdgeInBounds({ x: 4, y: 0, side: 'N' }, 4, 4)).toBe(false)
    expect(isEdgeInBounds({ x: -1, y: 0, side: 'W' }, 4, 4)).toBe(false)
    expect(isEdgeInBounds({ x: 1.5, y: 0, side: 'W' }, 4, 4)).toBe(false)
  })

  it('canonicity rejects non-canonical shared edges', () => {
    expect(isCanonical({ x: 1, y: 0, side: 'W' }, 4, 4)).toBe(true)
    // E внутренней клетки канонизируется в W соседа — сама по себе не канонична.
    expect(isCanonical({ x: 0, y: 0, side: 'E' }, 4, 4)).toBe(false)
    // E последней колонки — канонично (периметр).
    expect(isCanonical({ x: 3, y: 0, side: 'E' }, 4, 4)).toBe(true)
    expect(isCanonical({ x: 1, y: 3, side: 'S' }, 4, 4)).toBe(true)
  })

  it('hasWall matches by canonical key', () => {
    const walls = [
      { x: 1, y: 0, side: 'W' as const },
      { x: 3, y: 2, side: 'E' as const },
    ]
    expect(hasWall(walls, { x: 1, y: 0, side: 'W' })).toBe(true)
    expect(hasWall(walls, { x: 3, y: 2, side: 'E' })).toBe(true)
    expect(hasWall(walls, { x: 0, y: 0, side: 'E' })).toBe(false)
  })
})
