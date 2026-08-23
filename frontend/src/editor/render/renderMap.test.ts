import { describe, expect, it } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import { OBJECT_COLORS } from '../model/objects'
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

  it('draws each map object as a circle at its cell center', () => {
    const { ctx, calls } = makeFakeCtx()
    const withDoor = applyCommand(createEmptyMap(3, 3), {
      kind: 'addObject',
      x: 1,
      y: 1,
      kindId: 'door',
    })

    renderMap(ctx, withDoor, baseViewport())

    const arcs = calls.filter((c) => c.op === 'arc')
    expect(arcs).toHaveLength(1)
    expect(arcs[0]?.args[0]).toBe(48)
    expect(arcs[0]?.args[1]).toBe(48)

    const arcIndex = calls.indexOf(arcs[0]!)
    const fillAfterArc = calls.slice(arcIndex).find((c) => c.op === 'fill')
    expect(fillAfterArc?.fillStyle).toBe(OBJECT_COLORS.door)
  })

  it('draws objects in array order so the later one lands on top', () => {
    const { ctx, calls } = makeFakeCtx()
    let model = applyCommand(createEmptyMap(3, 3), {
      kind: 'addObject',
      x: 0,
      y: 0,
      kindId: 'door',
    })
    model = applyCommand(model, { kind: 'addObject', x: 2, y: 2, kindId: 'chest' })

    renderMap(ctx, model, baseViewport())

    const fills = calls.filter((c) => c.op === 'fill')
    expect(fills).toHaveLength(2)
    expect(fills[0]?.fillStyle).toBe(OBJECT_COLORS.door)
    expect(fills[1]?.fillStyle).toBe(OBJECT_COLORS.chest)
  })
})
