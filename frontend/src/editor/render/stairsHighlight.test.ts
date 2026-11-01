import { describe, expect, it } from 'vitest'
import { drawStairsSelection } from './stairsHighlight'
import { HIGHLIGHT_COLOR } from './colors'
import { makeFakeCtx } from './testFakeCtx'
import type { Viewport } from './viewport'

const viewport: Viewport = { width: 128, height: 128, cellSize: 32, offsetX: 0, offsetY: 0 }

describe('drawStairsSelection', () => {
  it('strokes a closed contour in the highlight colour', () => {
    const { ctx, calls, raw } = makeFakeCtx()
    drawStairsSelection(
      ctx,
      [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      viewport,
    )

    const move = calls.find((c) => c.op === 'moveTo')
    expect(move?.args).toEqual([32, 32])
    expect(calls.filter((c) => c.op === 'lineTo')).toHaveLength(3)
    expect(calls.some((c) => c.op === 'closePath')).toBe(true)
    expect(calls.some((c) => c.op === 'stroke' && c.fillStyle === HIGHLIGHT_COLOR)).toBe(true)
    expect(raw.lineWidth).toBe(2)
  })

  it('ignores a degenerate polygon', () => {
    const { ctx, calls } = makeFakeCtx()
    drawStairsSelection(
      ctx,
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      viewport,
    )
    expect(calls).toHaveLength(0)
  })
})
