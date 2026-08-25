import { describe, expect, it } from 'vitest'
import { TILE_TYPES } from '../model/types'
import { cellCenterAt } from './gridGeometry'
import { drawStrokePreview } from './strokePreview'
import { makeFakeCtx } from './testFakeCtx'

const FLOOR = TILE_TYPES.indexOf('floor')

describe('drawStrokePreview', () => {
  it('draws each pending square cell with translucent palette color', () => {
    const { ctx, calls, raw } = makeFakeCtx()
    drawStrokePreview(
      ctx,
      [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
      { width: 96, height: 96, cellSize: 32, offsetX: 0, offsetY: 0 },
      FLOOR,
      'square',
    )

    expect(calls).toHaveLength(2)
    expect(calls[0]?.args).toEqual([0, 0, 32, 32])
    expect(calls[0]?.fillStyle).toBeTruthy()
    expect(raw.globalAlpha).toBe(1)
  })

  it('accounts for viewport offset', () => {
    const { ctx, calls } = makeFakeCtx()
    drawStrokePreview(
      ctx,
      [{ x: 1, y: 1 }],
      { width: 96, height: 96, cellSize: 32, offsetX: 16, offsetY: 16 },
      FLOOR,
      'square',
    )

    expect(calls[0]?.args).toEqual([16, 16, 32, 32])
  })

  it('does nothing for an empty stroke and restores alpha', () => {
    const { ctx, calls, raw } = makeFakeCtx()
    drawStrokePreview(
      ctx,
      [],
      { width: 96, height: 96, cellSize: 32, offsetX: 0, offsetY: 0 },
      FLOOR,
      'square',
    )

    expect(calls).toHaveLength(0)
    expect(raw.globalAlpha).toBe(1)
  })

  it.each(['hex-pointy', 'hex-flat'] as const)(
    '%s: fills a hexagon centered on the pending hex cell',
    (gridType) => {
      const { ctx, calls, raw } = makeFakeCtx()
      drawStrokePreview(
        ctx,
        [{ x: 1, y: 1 }],
        { width: 320, height: 240, cellSize: 32, offsetX: 0, offsetY: 0 },
        FLOOR,
        gridType,
      )

      // beginPath → moveTo + 5×lineTo + closePath → fill
      expect(calls.filter((c) => c.op === 'beginPath')).toHaveLength(1)
      expect(calls.filter((c) => c.op === 'closePath')).toHaveLength(1)
      const segments = calls.filter((c) => c.op === 'moveTo' || c.op === 'lineTo')
      expect(segments).toHaveLength(6)
      const fill = calls.find((c) => c.op === 'fill')
      expect(fill?.fillStyle).toBeTruthy()

      // Вершины на окружности радиуса cellSize; первая вершина различает
      // ориентации: pointy −30°, flat 0°.
      const center = cellCenterAt(1, 1, gridType, 32)
      const firstAngle = gridType === 'hex-pointy' ? -Math.PI / 6 : 0
      expect(segments[0]?.args[0]).toBeCloseTo(center.x + Math.cos(firstAngle) * 32, 6)
      expect(segments[0]?.args[1]).toBeCloseTo(center.y + Math.sin(firstAngle) * 32, 6)
      for (const segment of segments) {
        const dx = (segment.args[0] as number) - center.x
        const dy = (segment.args[1] as number) - center.y
        expect(Math.hypot(dx, dy)).toBeCloseTo(32, 6)
      }
      expect(raw.globalAlpha).toBe(1)
    },
  )

  it('fills every pending hex cell and restores alpha afterwards', () => {
    const { ctx, calls } = makeFakeCtx()
    drawStrokePreview(
      ctx,
      [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
      { width: 320, height: 240, cellSize: 32, offsetX: 40, offsetY: 24 },
      FLOOR,
      'hex-flat',
    )

    expect(calls.filter((c) => c.op === 'beginPath')).toHaveLength(2)
    expect(calls.filter((c) => c.op === 'fill')).toHaveLength(2)
    // Первая вершина flat-гекса — угол 0°: ровно (+32, 0) от центра.
    for (const [col, row] of [
      [0, 0],
      [2, 1],
    ] as const) {
      const center = cellCenterAt(col, row, 'hex-flat', 32)
      const first = calls.find(
        (c) =>
          c.op === 'moveTo' &&
          Math.abs((c.args[0] as number) - (center.x - 40 + 32)) < 1e-6 &&
          Math.abs((c.args[1] as number) - (center.y - 24)) < 1e-6,
      )
      expect(first).toBeDefined()
    }
  })
})
