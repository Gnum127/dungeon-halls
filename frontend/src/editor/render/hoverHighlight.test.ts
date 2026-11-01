import { describe, expect, it } from 'vitest'
import { drawHoverHighlight } from './hoverHighlight'
import { makeFakeCtx } from './testFakeCtx'
import type { Viewport } from './viewport'

const viewport: Viewport = { width: 128, height: 128, cellSize: 32, offsetX: 0, offsetY: 0 }

describe('drawHoverHighlight', () => {
  it('highlights the 0.5 quadrant for texture tools', () => {
    const { ctx, calls } = makeFakeCtx()
    drawHoverHighlight(
      ctx,
      { type: 'region-rect', tileType: 'floor' },
      { x: 1, y: 1 },
      { x: 1.25, y: 1.75 },
      viewport,
    )

    const strokeRect = calls.find((c) => c.op === 'strokeRect')
    expect(strokeRect?.args).toEqual([33, 49, 14, 14])
  })

  it('highlights the whole cell for non-texture tools', () => {
    const { ctx, calls } = makeFakeCtx()
    drawHoverHighlight(ctx, { type: 'wall' }, { x: 1, y: 2 }, { x: 1.25, y: 2.75 }, viewport)

    const strokeRect = calls.find((c) => c.op === 'strokeRect')
    // Full cell (1,2): screen (32..64, 64..96), inset by 1 → 30×30.
    expect(strokeRect?.args).toEqual([33, 65, 30, 30])
  })
})
