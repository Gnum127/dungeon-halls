import { describe, expect, it } from 'vitest'
import { TILE_TYPES } from '../model/types'
import { drawStrokePreview } from './strokePreview'
import { makeFakeCtx } from './testFakeCtx'

const FLOOR = TILE_TYPES.indexOf('floor')

describe('drawStrokePreview', () => {
  it('draws each pending cell with translucent palette color', () => {
    const { ctx, calls, raw } = makeFakeCtx()
    drawStrokePreview(
      ctx,
      [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
      { width: 96, height: 96, cellSize: 32, offsetX: 0, offsetY: 0 },
      FLOOR,
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
    )

    expect(calls).toHaveLength(0)
    expect(raw.globalAlpha).toBe(1)
  })
})
