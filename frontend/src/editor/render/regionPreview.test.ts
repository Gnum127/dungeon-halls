import { describe, expect, it } from 'vitest'
import { drawRegionPreview } from './regionPreview'
import { TILE_COLORS } from './colors'
import { makeFakeCtx } from './testFakeCtx'
import { createWallSegment } from '../model/wallSegments'
import type { Viewport } from './viewport'

const viewport: Viewport = { width: 128, height: 128, cellSize: 32, offsetX: 0, offsetY: 0 }

const triangle = [
  { x: 1, y: 1 },
  { x: 3, y: 1 },
  { x: 2, y: 3 },
]

describe('drawRegionPreview', () => {
  it('fills a multi-vertex shape (regression: N-gon preview was never drawn)', () => {
    const { ctx, calls } = makeFakeCtx()
    drawRegionPreview(ctx, { polygon: triangle, walls: [], tileType: 'floor' }, viewport)

    expect(calls.some((c) => c.op === 'fill' && c.fillStyle === TILE_COLORS.floor)).toBe(true)
    expect(calls.some((c) => c.op === 'closePath')).toBe(true)
  })

  it('strokes preview walls when provided', () => {
    const { ctx, calls, raw } = makeFakeCtx()
    const wall = createWallSegment(
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
      ],
      { id: 'w1' },
    )
    drawRegionPreview(ctx, { polygon: triangle, walls: [wall], tileType: 'floor' }, viewport)

    expect(calls.some((c) => c.op === 'stroke')).toBe(true)
    expect(raw.lineWidth).toBe(3)
  })

  it('does nothing for fewer than 3 points', () => {
    const { ctx, calls } = makeFakeCtx()
    drawRegionPreview(
      ctx,
      {
        polygon: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        walls: [],
        tileType: 'floor',
      },
      viewport,
    )
    expect(calls).toEqual([])
  })
})
