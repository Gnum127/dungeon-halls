import { describe, expect, it } from 'vitest'
import type { WallEdge } from '../model/walls'
import { EDGE_HIGHLIGHT_COLOR } from './colors'
import { drawEdgeHighlight } from './edgeHighlight'
import { makeFakeCtx } from './testFakeCtx'
import type { Viewport } from './viewport'

function viewport(offsetX = 0, offsetY = 0): Viewport {
  return { width: 96, height: 96, cellSize: 32, offsetX, offsetY }
}

describe('drawEdgeHighlight', () => {
  const cases: Array<[WallEdge, Array<number>]> = [
    [{ x: 1, y: 0, side: 'N' }, [32, 0, 64, 0]],
    [{ x: 1, y: 2, side: 'S' }, [32, 96, 64, 96]],
    [{ x: 1, y: 1, side: 'W' }, [32, 32, 32, 64]],
    // E периметра последней колонки.
    [{ x: 2, y: 0, side: 'E' }, [96, 0, 96, 32]],
  ]

  it.each(cases)('strokes %j along the edge', (edge, expected) => {
    const { ctx, calls } = makeFakeCtx()
    drawEdgeHighlight(ctx, edge, viewport())

    expect(calls.filter((c) => c.op === 'stroke')).toHaveLength(1)
    expect(ctx.strokeStyle).toBe(EDGE_HIGHLIGHT_COLOR)
    const moveTo = calls.find((c) => c.op === 'moveTo')
    const lineTo = calls.find((c) => c.op === 'lineTo')
    expect(moveTo?.args).toEqual([expected[0], expected[1]])
    expect(lineTo?.args).toEqual([expected[2], expected[3]])
  })

  it('shifts with the viewport offset', () => {
    const { ctx, calls } = makeFakeCtx()
    drawEdgeHighlight(ctx, { x: 1, y: 0, side: 'N' }, viewport(10, -5))

    const moveTo = calls.find((c) => c.op === 'moveTo')
    expect(moveTo?.args).toEqual([32 - 10, 0 + 5])
  })
})
