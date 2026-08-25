import { describe, expect, it } from 'vitest'
import type { Viewport } from '../render/viewport'
import { commitWallStroke, nearestEdgeAt } from './walls'

const CELL = 32

function viewport(overrides: Partial<Viewport> = {}): Viewport {
  return { width: 96, height: 96, cellSize: CELL, offsetX: 0, offsetY: 0, ...overrides }
}

describe('nearestEdgeAt', () => {
  it('picks the closer grid line and canonicalizes shared edges', () => {
    // Точка у левой стороны клетки (1,0): вертикальная линия между (0,0) и (1,0).
    expect(nearestEdgeAt(viewport(), 34, 16, 3, 3)).toEqual({ x: 1, y: 0, side: 'W' })
    // Точка у верхней стороны клетки (1,1).
    expect(nearestEdgeAt(viewport(), 48, 35, 3, 3)).toEqual({ x: 1, y: 1, side: 'N' })
  })

  it('returns perimeter edges as-is on the far right and bottom', () => {
    expect(nearestEdgeAt(viewport(), 95, 16, 3, 3)).toEqual({ x: 2, y: 0, side: 'E' })
    expect(nearestEdgeAt(viewport(), 48, 94, 3, 3)).toEqual({ x: 1, y: 2, side: 'S' })
  })

  it('returns null beyond half a cell outside the map', () => {
    expect(nearestEdgeAt(viewport(), -20, 16, 3, 3)).toBeNull()
    expect(nearestEdgeAt(viewport(), 130, 16, 3, 3)).toBeNull()
    // Ровно на границе допуска — ещё валидно.
    expect(nearestEdgeAt(viewport(), -15, 16, 3, 3)).not.toBeNull()
    expect(nearestEdgeAt(viewport(), 110, 16, 3, 3)).toEqual({ x: 2, y: 0, side: 'E' })
  })

  it('respects zoom and scroll through the viewport', () => {
    // Конвенция: мир = экран + оффсет.
    const scrolled = viewport({ cellSize: 64, offsetX: 50, offsetY: 30 })
    // wx = 14+50 = 64 → вертикальная линия x=64 (dist 0);
    // wy = 40+30 = 70 → строка 1. Вертикаль ближе.
    expect(nearestEdgeAt(scrolled, 14, 40, 4, 4)).toEqual({ x: 1, y: 1, side: 'W' })
    // Горизонтальная линия ближе: wy=70 почти на y=64, wx=150 посреди клетки 2.
    expect(nearestEdgeAt(scrolled, 100, 40, 4, 4)).toEqual({ x: 2, y: 1, side: 'N' })

    const zoomedOut = viewport({ cellSize: 8 })
    // wx = 13 → линия x=16 (round(13/8)=2); wy = 4 → строка 0.
    expect(nearestEdgeAt(zoomedOut, 13, 4, 6, 6)).toEqual({ x: 2, y: 0, side: 'W' })
  })
})

describe('commitWallStroke', () => {
  it('builds one setWalls command with normalized deduped edges', () => {
    const command = commitWallStroke(
      { width: 3, height: 3 },
      [
        { x: 0, y: 0, side: 'E' },
        { x: 1, y: 0, side: 'W' },
        { x: 9, y: 9, side: 'N' },
      ],
      true,
    )
    expect(command).toEqual({
      kind: 'setWalls',
      updates: [{ edge: { x: 1, y: 0, side: 'W' }, present: true }],
    })
  })

  it('returns null for an empty stroke', () => {
    expect(commitWallStroke({ width: 3, height: 3 }, [], true)).toBeNull()
    expect(commitWallStroke({ width: 3, height: 3 }, [{ x: 9, y: 9, side: 'N' }], false)).toBeNull()
  })

  it('keeps valid edges for the eraser with present:false', () => {
    const command = commitWallStroke({ width: 3, height: 3 }, [{ x: 2, y: 2, side: 'E' }], false)
    expect(command).toEqual({
      kind: 'setWalls',
      updates: [{ edge: { x: 2, y: 2, side: 'E' }, present: false }],
    })
  })

  it('breaks corner ties toward the vertical line', () => {
    // Точка ровно в углу клетки: обе дистанции нулевые → вертикальная ветка.
    expect(nearestEdgeAt(viewport(), 32, 32, 3, 3)).toEqual({ x: 1, y: 1, side: 'W' })
  })
})
