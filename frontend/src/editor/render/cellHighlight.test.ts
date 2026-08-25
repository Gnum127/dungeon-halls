import { describe, expect, it } from 'vitest'
import { drawCellHighlight } from './cellHighlight'
import { HIGHLIGHT_COLOR } from './colors'
import { cellCenterAt } from './gridGeometry'
import { makeFakeCtx } from './testFakeCtx'
import type { Viewport } from './viewport'

function baseViewport(): Viewport {
  return { width: 96, height: 96, cellSize: 32, offsetX: 0, offsetY: 0 }
}

describe('drawCellHighlight', () => {
  it('strokes an inset frame around the hovered cell', () => {
    const { ctx, calls, raw } = makeFakeCtx()
    drawCellHighlight(ctx, { x: 1, y: 2 }, baseViewport(), 'square')

    const strokeRect = calls.find((c) => c.op === 'strokeRect')
    expect(strokeRect).toBeDefined()
    expect(strokeRect?.args).toEqual([33, 65, 30, 30])
    expect(raw.strokeStyle).toBe(HIGHLIGHT_COLOR)
    expect(raw.lineWidth).toBe(2)
  })

  it('accounts for viewport offset', () => {
    const { ctx, calls } = makeFakeCtx()
    drawCellHighlight(
      ctx,
      { x: 0, y: 0 },
      { ...baseViewport(), offsetX: 64, offsetY: 32 },
      'square',
    )

    const strokeRect = calls.find((c) => c.op === 'strokeRect')
    expect(strokeRect?.args).toEqual([-63, -31, 30, 30])
  })

  it('keeps the inset at non-base zoom levels', () => {
    const { ctx, calls } = makeFakeCtx()
    drawCellHighlight(ctx, { x: 2, y: 1 }, { ...baseViewport(), cellSize: 16 }, 'square')

    const strokeRect = calls.find((c) => c.op === 'strokeRect')
    expect(strokeRect?.args).toEqual([33, 17, 14, 14])
  })

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: strokes an inset hexagon around the hovered hex cell',
    (gridType) => {
      const { ctx, calls, raw } = makeFakeCtx()
      drawCellHighlight(ctx, { x: 1, y: 1 }, baseViewport(), gridType)

      expect(calls.find((c) => c.op === 'strokeRect')).toBeUndefined()
      expect(calls.filter((c) => c.op === 'beginPath')).toHaveLength(1)
      const segments = calls.filter((c) => c.op === 'moveTo' || c.op === 'lineTo')
      expect(segments).toHaveLength(6)
      expect(raw.strokeStyle).toBe(HIGHLIGHT_COLOR)

      // Радиус вжат на 3px; первая вершина различает ориентации:
      // pointy начинает с угла −30°, flat — с 0°.
      const center = cellCenterAt(1, 1, gridType, 32)
      const firstAngle = gridType === 'hex-pointy' ? -Math.PI / 6 : 0
      expect(segments[0]?.args[0]).toBeCloseTo(center.x + Math.cos(firstAngle) * 29, 6)
      expect(segments[0]?.args[1]).toBeCloseTo(center.y + Math.sin(firstAngle) * 29, 6)
      for (const segment of segments) {
        const dx = (segment.args[0] as number) - center.x
        const dy = (segment.args[1] as number) - center.y
        expect(Math.hypot(dx, dy)).toBeCloseTo(29, 6)
      }
      expect(raw.lineWidth).toBe(2)
    },
  )

  it('accounts for viewport offset in the hex branch', () => {
    const { ctx, calls } = makeFakeCtx()
    drawCellHighlight(
      ctx,
      { x: 0, y: 0 },
      { ...baseViewport(), offsetX: 64, offsetY: 48 },
      'hex-pointy',
    )

    const center = cellCenterAt(0, 0, 'hex-pointy', 32)
    const first = calls.find((c) => c.op === 'moveTo')
    // Первая вершина pointy-гекса — угол −30° при радиусе 29.
    expect(first?.args[0]).toBeCloseTo(center.x - 64 + Math.cos(-Math.PI / 6) * 29, 6)
    expect(first?.args[1]).toBeCloseTo(center.y - 48 + Math.sin(-Math.PI / 6) * 29, 6)
  })
})
