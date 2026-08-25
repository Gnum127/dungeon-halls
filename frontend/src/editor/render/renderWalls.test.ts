import { describe, expect, it } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import type { MapModel } from '../model/types'
import { DOOR_FILL_COLOR, WALL_LINE_COLOR } from './colors'
import { renderMap } from './renderMap'
import { makeFakeCtx } from './testFakeCtx'

const SIZE = 32

function viewport() {
  return { width: 96, height: 96, cellSize: SIZE, offsetX: 0, offsetY: 0 }
}

function walledModel(): MapModel {
  let model = applyCommand(createEmptyMap(3, 3), {
    kind: 'setWalls',
    updates: [
      { edge: { x: 1, y: 0, side: 'W' }, present: true },
      { edge: { x: 0, y: 1, side: 'N' }, present: true },
    ],
  })
  model = applyCommand(model, { kind: 'addDoor', edge: { x: 1, y: 0, side: 'W' } })
  return applyCommand(model, { kind: 'addObject', x: 2, y: 2, kindId: 'chest' })
}

describe('renderMap walls and doors', () => {
  it('strokes all wall edges in a single path over the tiles and objects', () => {
    const model = walledModel()
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, model, viewport())

    // Ровно один stroke стеновым цветом — рёбра собираются в один path.
    const wallStrokes = calls.filter((c) => c.op === 'stroke' && c.fillStyle === WALL_LINE_COLOR)
    expect(wallStrokes).toHaveLength(1)
    // Два ребра → два moveTo внутри этого пути с точными координатами.
    const wallStrokeIdx = calls.indexOf(wallStrokes[0]!)
    let pathStart = wallStrokeIdx
    while (pathStart > 0 && calls[pathStart]?.op !== 'beginPath') pathStart -= 1
    const segment = calls.slice(pathStart + 1, wallStrokeIdx)
    const moves = segment.filter((c) => c.op === 'moveTo')
    expect(moves.map((c) => c.args)).toEqual([
      [32, 0],
      [0, 32],
    ])
    // Стены рисуются после объектов (кружок chest в (2,2)).
    const arcIdx = calls.findIndex((c) => c.op === 'arc')
    expect(arcIdx).toBeGreaterThanOrEqual(0)
    expect(wallStrokeIdx).toBeGreaterThan(arcIdx)
  })

  it('draws a closed door as a panel centered on its edge', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, walledModel(), viewport())

    // Ребро W клетки (1,0): толщина max(4, 32*0.18)=6, полотно 60% длины
    // по центру ребра y∈[0..32] → прямоугольник [29, 6.4, 6, 19.2].
    const doorFill = calls.find((c) => c.op === 'fillRect' && c.fillStyle === DOOR_FILL_COLOR)
    expect(doorFill?.args).toEqual([29, 6.4, 6, 19.2])
  })

  it('renders an open door as two leaves with a gap', () => {
    let model = applyCommand(createEmptyMap(3, 3), {
      kind: 'toggleWall',
      edge: { x: 1, y: 0, side: 'W' },
    })
    model = applyCommand(model, { kind: 'addDoor', edge: { x: 1, y: 0, side: 'W' } })
    model = applyCommand(model, { kind: 'setDoorOpen', id: 1, open: true })

    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, model, viewport())

    const doorFills = calls.filter((c) => c.op === 'fillRect' && c.fillStyle === DOOR_FILL_COLOR)
    expect(doorFills).toHaveLength(2)
    // Просвет в середине: сегменты у концов ребра.
    expect(doorFills[0]?.args).toEqual([29, 0, 6, 6.4])
    expect(doorFills[1]?.args).toEqual([29, 25.6, 6, 6.4])
  })

  it('keeps drawing walls in sprite mode (both display modes)', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, walledModel(), viewport(), { tiles: {}, objects: {} })

    expect(calls.filter((c) => c.op === 'stroke' && c.fillStyle === WALL_LINE_COLOR)).toHaveLength(
      1,
    )
    expect(calls.some((c) => c.op === 'fillRect' && c.fillStyle === DOOR_FILL_COLOR)).toBe(true)
  })

  it('does not draw walls or doors on hex maps (defense-in-depth)', () => {
    const { ctx, calls } = makeFakeCtx()
    // Недостижимое через UI состояние моделируем явно: square-карта со
    // стенами/дверью, у которой сменён gridType.
    const hexed = { ...walledModel(), gridType: 'hex-pointy' } as MapModel
    renderMap(ctx, hexed, viewport())

    expect(calls.some((c) => c.op === 'fillRect' && c.fillStyle === DOOR_FILL_COLOR)).toBe(false)
    expect(calls.some((c) => c.op === 'stroke' && c.fillStyle === WALL_LINE_COLOR)).toBe(false)
  })
})
