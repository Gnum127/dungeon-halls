import { describe, expect, it } from 'vitest'
import { applyCommand } from '../model/commands'
import type { Command } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import { TILE_TYPES } from '../model/types'
import type { MapModel } from '../model/types'
import { commitStroke, isInsideMap } from './brush'

const FLOOR = TILE_TYPES.indexOf('floor')
const WATER = TILE_TYPES.indexOf('water')

type SetTilesCommand = Extract<Command, { kind: 'setTiles' }>

function assertSetTiles(command: Command | null): asserts command is SetTilesCommand {
  if (!command || command.kind !== 'setTiles') throw new Error('Expected a setTiles command')
}

function makeMap(): MapModel {
  return createEmptyMap(4, 4)
}

describe('isInsideMap', () => {
  it('accepts cells within bounds', () => {
    expect(isInsideMap(makeMap(), 0, 0)).toBe(true)
    expect(isInsideMap(makeMap(), 3, 3)).toBe(true)
  })

  it('rejects cells outside, on the border and non-integers', () => {
    expect(isInsideMap(makeMap(), 4, 2)).toBe(false)
    expect(isInsideMap(makeMap(), 2, -1)).toBe(false)
    expect(isInsideMap(makeMap(), -1, 0)).toBe(false)
    expect(isInsideMap(makeMap(), 1.5, 1)).toBe(false)
    expect(isInsideMap(makeMap(), Number.NaN, 0)).toBe(false)
  })
})

describe('commitStroke', () => {
  it('builds a single setTiles command from stroke cells', () => {
    const command = commitStroke(
      makeMap(),
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      FLOOR,
    )

    expect(command).toEqual({
      kind: 'setTiles',
      updates: [
        { x: 0, y: 0, tile: FLOOR },
        { x: 1, y: 1, tile: FLOOR },
      ],
    })
    expect(command?.kind).toBe('setTiles')
  })

  it('drops cells outside the map', () => {
    const command = commitStroke(
      makeMap(),
      [
        { x: 9, y: 9 },
        { x: 1, y: 0 },
      ],
      FLOOR,
    )

    assertSetTiles(command)
    expect(command.updates).toEqual([{ x: 1, y: 0, tile: FLOOR }])
  })

  it('resolves duplicate cells in favor of the last visit and keeps order', () => {
    const command = commitStroke(
      makeMap(),
      [
        { x: 2, y: 0 },
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 3 },
      ],
      FLOOR,
    )

    assertSetTiles(command)
    expect(command.updates).toEqual([
      { x: 2, y: 0, tile: FLOOR },
      { x: 0, y: 0, tile: FLOOR },
      { x: 3, y: 3, tile: FLOOR },
    ])
  })

  it('returns null for an empty or fully outside stroke', () => {
    expect(commitStroke(makeMap(), [], FLOOR)).toBeNull()
    expect(commitStroke(makeMap(), [{ x: 99, y: 99 }], FLOOR)).toBeNull()
  })

  it('rejects invalid tile value', () => {
    expect(() => commitStroke(makeMap(), [{ x: 0, y: 0 }], TILE_TYPES.length)).toThrow(RangeError)
    expect(() => commitStroke(makeMap(), [], -1)).toThrow(RangeError)
  })

  it('command applies immutably to the model', () => {
    const model = makeMap()
    const command = commitStroke(
      model,
      [
        { x: 0, y: 0 },
        { x: 3, y: 3 },
      ],
      WATER,
    )
    const next = applyCommand(model, command!)

    expect(next).not.toBe(model)
    expect(next.tiles[0]).toBe(WATER)
    expect(next.tiles[3 * 4 + 3]).toBe(WATER)
    expect(model.tiles[0]).toBe(0)
  })

  it('no-op stroke produces a command that keeps model reference', () => {
    const model = applyCommand(makeMap(), { kind: 'setTile', x: 1, y: 1, tile: FLOOR })
    const command = commitStroke(model, [{ x: 1, y: 1 }], FLOOR)
    const next = applyCommand(model, command!)

    expect(next).toBe(model)
  })
})
