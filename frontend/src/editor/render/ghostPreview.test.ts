import { describe, expect, it } from 'vitest'
import { drawGhostPreview } from './ghostPreview'
import { makeFakeCtx } from './testFakeCtx'
import type { EditorTool } from '../tools/editorTool'
import type { Viewport } from './viewport'

const viewport: Viewport = { width: 320, height: 240, cellSize: 32, offsetX: 0, offsetY: 0 }

const TOOL: Extract<EditorTool, { type: 'object' }> = {
  type: 'object',
  kindId: 'torch',
  rotation: 0,
  scale: { w: 2, h: 1 },
}

describe('drawGhostPreview', () => {
  it('anchors the ghost at the float top-left plus half the footprint', () => {
    const { ctx, calls } = makeFakeCtx()

    drawGhostPreview(ctx, { x: 1.5, y: 2 }, viewport, TOOL)

    // cx = 1.5*32 + (2*32)/2 = 80; cy = 2*32 + (1*32)/2 = 80.
    const translate = calls.find((c) => c.op === 'translate')
    expect(translate?.args).toEqual([1.5 * 32 + 32, 2 * 32 + 16])
    const rect = calls.find((c) => c.op === 'fillRect')
    expect(rect?.args).toEqual([-32, -16, 64, 32])
  })

  it('rotates the ghost around its center for a rotated tool', () => {
    const { ctx, raw } = makeFakeCtx()

    drawGhostPreview(ctx, { x: 1.5, y: 2 }, viewport, { ...TOOL, rotation: 90 })

    expect(raw.lastRotate).toBeCloseTo(Math.PI / 2)
  })

  it('restores the previous globalAlpha after drawing', () => {
    const { ctx, raw } = makeFakeCtx()
    raw.globalAlpha = 0.8

    drawGhostPreview(ctx, { x: 1.5, y: 2 }, viewport, TOOL)

    expect(raw.globalAlpha).toBe(0.8)
  })
})
