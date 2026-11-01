import { describe, expect, it } from 'vitest'
import { drawQuadrantHighlight } from './quadrantHighlight'
import { HIGHLIGHT_COLOR } from './colors'
import { makeFakeCtx } from './testFakeCtx'
import type { Viewport } from './viewport'

const viewport: Viewport = { width: 128, height: 128, cellSize: 32, offsetX: 0, offsetY: 0 }

describe('drawQuadrantHighlight', () => {
  it('highlights the 0.5×0.5 quadrant containing the cursor', () => {
    const { ctx, calls, raw } = makeFakeCtx()
    drawQuadrantHighlight(ctx, { x: 1.25, y: 2.75 }, viewport)

    const strokeRect = calls.find((c) => c.op === 'strokeRect')
    // Cell (1,2), quadrant (1.0..1.5, 2.5..3.0) → screen (32..48, 80..96).
    expect(strokeRect?.args).toEqual([33, 81, 14, 14])
    expect(raw.strokeStyle).toBe(HIGHLIGHT_COLOR)
    expect(raw.lineWidth).toBe(2)
  })

  it('picks the far quadrant past the half-cell mark', () => {
    const { ctx, calls } = makeFakeCtx()
    drawQuadrantHighlight(ctx, { x: 1.6, y: 2.1 }, viewport)

    const strokeRect = calls.find((c) => c.op === 'strokeRect')
    expect(strokeRect?.args).toEqual([49, 65, 14, 14])
  })

  it('maps through the viewport offset and zoom', () => {
    const { ctx, calls } = makeFakeCtx()
    const zoomed: Viewport = { width: 128, height: 128, cellSize: 64, offsetX: 16, offsetY: 8 }
    drawQuadrantHighlight(ctx, { x: 2.5, y: 1.5 }, zoomed)

    const strokeRect = calls.find((c) => c.op === 'strokeRect')
    expect(strokeRect?.args).toEqual([2.5 * 64 - 16 + 1, 1.5 * 64 - 8 + 1, 30, 30])
  })

  it('assigns a point exactly on the 0.5 boundary to the upper-left quadrant', () => {
    const { ctx, calls } = makeFakeCtx()
    drawQuadrantHighlight(ctx, { x: 1.5, y: 2.5 }, viewport)

    const strokeRect = calls.find((c) => c.op === 'strokeRect')
    // 1.5 and 2.5 are quadrant origins → the quadrant starting there.
    expect(strokeRect?.args).toEqual([49, 81, 14, 14])
  })
})
