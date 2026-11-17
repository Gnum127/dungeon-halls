import { describe, expect, it } from 'vitest'
import { drawDoorSelection, drawObjectSelection } from './selectionHighlight'
import { HIGHLIGHT_COLOR, HIGHLIGHT_FILL_COLOR } from './colors'
import { makeFakeCtx } from './testFakeCtx'
import type { Viewport } from './viewport'

const viewport: Viewport = { width: 256, height: 256, cellSize: 32, offsetX: 0, offsetY: 0 }

describe('drawObjectSelection', () => {
  it('draws the translucent fill, frame and four corner handles', () => {
    const { ctx, raw, calls } = makeFakeCtx()
    drawObjectSelection(
      ctx,
      { id: 1, kindId: 'table', x: 1, y: 2, scale: { w: 2, h: 1 } },
      viewport,
    )

    // x=1,y=2 → screen (32,64), 2×1 cells → 64×32.
    const fill = calls.find((c) => c.op === 'fillRect' && c.fillStyle === HIGHLIGHT_FILL_COLOR)
    expect(fill?.args).toEqual([32, 64, 64, 32])

    const frame = calls.find((c) => c.op === 'strokeRect')
    // strokeRect пишется фейком со style-снимком fillStyle; цвет рамки — strokeStyle.
    expect(raw.strokeStyle).toBe(HIGHLIGHT_COLOR)
    expect(frame?.args).toEqual([32, 64, 64, 32])

    const handles = calls.filter((c) => c.op === 'fillRect' && c.fillStyle === HIGHLIGHT_COLOR)
    expect(handles).toHaveLength(4)
    // Центры квадратов — углы footprint'а (мировые → экранные).
    const size = Math.max(5, 32 * 0.16)
    const centers = handles.map((c) => ({
      x: (c.args[0] as number) + size / 2,
      y: (c.args[1] as number) + size / 2,
    }))
    for (const [cx, cy] of [
      [32, 64],
      [96, 64],
      [32, 96],
      [96, 96],
    ]) {
      expect(centers.some((c) => Math.abs(c.x - cx) < 1e-6 && Math.abs(c.y - cy) < 1e-6)).toBe(true)
    }
  })

  it('uses a 1×1 footprint when scale is absent', () => {
    const { ctx, calls } = makeFakeCtx()
    drawObjectSelection(ctx, { id: 2, kindId: 'chair', x: 0.5, y: 0.5 }, viewport)

    expect(calls.find((c) => c.op === 'strokeRect')?.args).toEqual([16, 16, 32, 32])
  })
})

describe('drawDoorSelection', () => {
  it('draws a highlight strip along the a–b segment', () => {
    const { ctx, calls } = makeFakeCtx()
    drawDoorSelection(
      ctx,
      { id: 'd1', a: { x: 1, y: 1 }, b: { x: 3, y: 1 }, imageId: null },
      viewport,
    )

    const move = calls.find((c) => c.op === 'moveTo')
    const line = calls.find((c) => c.op === 'lineTo')
    expect(move?.args).toEqual([32, 32])
    expect(line?.args).toEqual([96, 32])
    expect(calls.find((c) => c.op === 'stroke')?.fillStyle).toBe(HIGHLIGHT_COLOR)
  })
})
