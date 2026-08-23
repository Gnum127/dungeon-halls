import { describe, expect, it } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import { TILE_TYPES } from '../model/types'
import type { MapModel } from '../model/types'
import { CANVAS_BACKGROUND_COLOR, GRID_LINE_COLOR, TILE_COLORS } from './colors'
import { renderMap } from './renderMap'
import { makeFakeCtx } from './testFakeCtx'
import type { Viewport } from './viewport'

const FLOOR = TILE_TYPES.indexOf('floor')

function makeModel(): MapModel {
  return applyCommand(createEmptyMap(3, 3), { kind: 'setTile', x: 1, y: 1, tile: FLOOR })
}

function baseViewport(): Viewport {
  return { width: 96, height: 96, cellSize: 32, offsetX: 0, offsetY: 0 }
}

describe('renderMap', () => {
  it('paints the background first', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, createEmptyMap(3, 3), baseViewport())

    expect(calls[0]).toMatchObject({
      op: 'fillRect',
      args: [0, 0, 96, 96],
      fillStyle: CANVAS_BACKGROUND_COLOR,
    })
  })

  it('draws exactly one rect per visible map cell', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, createEmptyMap(3, 3), baseViewport())

    const fills = calls.filter((c) => c.op === 'fillRect')
    expect(fills).toHaveLength(10)
  })

  it('uses the palette color for the painted tile', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, makeModel(), baseViewport())

    const centerTile = calls.find(
      (c) => c.op === 'fillRect' && c.args[0] === 32 && c.args[1] === 32,
    )
    expect(centerTile).toBeDefined()
    expect(centerTile?.fillStyle).toBe(TILE_COLORS.floor)
    expect(
      calls.filter((c) => c.op === 'fillRect' && c.fillStyle === TILE_COLORS.floor),
    ).toHaveLength(1)
  })

  it('shifts cells opposite to viewport offset', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, makeModel(), { ...baseViewport(), offsetX: 16, offsetY: 16 })

    const centerTile = calls.find(
      (c) => c.op === 'fillRect' && c.args[0] === 16 && c.args[1] === 16,
    )
    expect(centerTile?.fillStyle).toBe(TILE_COLORS.floor)
  })

  it('strokes grid lines over the map extent only', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, createEmptyMap(2, 2), { ...baseViewport(), width: 200, height: 200 })

    const stroke = calls.find((c) => c.op === 'stroke')
    expect(stroke).toBeDefined()
    expect(stroke?.fillStyle).toBe(GRID_LINE_COLOR)

    // Карта 2x2 по 32px: вертикали на x=0,32,64 (+0.5) и ничего дальше 64.
    const verticalXs = calls.filter((c) => c.op === 'moveTo').map((c) => c.args[0])
    expect(verticalXs.every((x) => (x as number) <= 64.5)).toBe(true)
  })
})
