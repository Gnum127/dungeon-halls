import { describe, expect, it } from 'vitest'
import { drawCellHighlight } from './cellHighlight'
import { HIGHLIGHT_COLOR } from './colors'
import { makeFakeCtx } from './testFakeCtx'
import type { Viewport } from './viewport'

function baseViewport(): Viewport {
  return { width: 96, height: 96, cellSize: 32, offsetX: 0, offsetY: 0 }
}

describe('drawCellHighlight', () => {
  it('strokes an inset frame around the hovered cell', () => {
    const { ctx, calls, raw } = makeFakeCtx()
    drawCellHighlight(ctx, { x: 1, y: 2 }, baseViewport())

    const strokeRect = calls.find((c) => c.op === 'strokeRect')
    expect(strokeRect).toBeDefined()
    expect(strokeRect?.args).toEqual([33, 65, 30, 30])
    expect(raw.strokeStyle).toBe(HIGHLIGHT_COLOR)
    expect(raw.lineWidth).toBe(2)
  })

  it('accounts for viewport offset', () => {
    const { ctx, calls } = makeFakeCtx()
    drawCellHighlight(ctx, { x: 0, y: 0 }, { ...baseViewport(), offsetX: 64, offsetY: 32 })

    const strokeRect = calls.find((c) => c.op === 'strokeRect')
    expect(strokeRect?.args).toEqual([-63, -31, 30, 30])
  })

  it('keeps the inset at non-base zoom levels', () => {
    const { ctx, calls } = makeFakeCtx()
    drawCellHighlight(ctx, { x: 2, y: 1 }, { ...baseViewport(), cellSize: 16 })

    const strokeRect = calls.find((c) => c.op === 'strokeRect')
    expect(strokeRect?.args).toEqual([33, 17, 14, 14])
  })
})
