import { describe, expect, it } from 'vitest'
import { applyCommand } from './commands'
import type { Command } from './commands'
import { createEmptyMap } from './createEmptyMap'
import { TILE_TYPES } from './types'
import type { MapModel } from './types'

function makeMap(): MapModel {
  return createEmptyMap(3, 3)
}

const FLOOR = TILE_TYPES.indexOf('floor')
const WATER = TILE_TYPES.indexOf('water')

describe('applyCommand', () => {
  it('setTile changes only the target cell', () => {
    const next = applyCommand(makeMap(), { kind: 'setTile', x: 1, y: 2, tile: FLOOR })

    expect(next.tiles[2 * 3 + 1]).toBe(FLOOR)
    let nonEmpty = 0
    for (const tile of next.tiles) if (tile !== 0) nonEmpty += 1
    expect(nonEmpty).toBe(1)
  })

  it('accepts boundary coordinates and tile values', () => {
    const WALL = TILE_TYPES.length - 1
    const next = applyCommand(makeMap(), { kind: 'setTile', x: 2, y: 2, tile: WALL })

    expect(next.tiles[2 * 3 + 2]).toBe(WALL)
  })

  it('preserves version, dimensions and objects of the source model', () => {
    const source = makeMap()
    const next = applyCommand(source, { kind: 'setTile', x: 0, y: 0, tile: FLOOR })

    expect(next.version).toBe(source.version)
    expect(next.width).toBe(source.width)
    expect(next.height).toBe(source.height)
    expect(next.objects).toBe(source.objects)
  })

  it('does not mutate the source model', () => {
    const source = makeMap()
    applyCommand(source, { kind: 'setTile', x: 0, y: 0, tile: FLOOR })

    expect(source.tiles[0]).toBe(0)
  })

  it('setTiles applies every update and returns a new model object', () => {
    const command: Command = {
      kind: 'setTiles',
      updates: [
        { x: 0, y: 0, tile: FLOOR },
        { x: 2, y: 1, tile: WATER },
      ],
    }
    const source = makeMap()
    const next = applyCommand(source, command)

    expect(next).not.toBe(source)
    expect(next.tiles[0]).toBe(FLOOR)
    expect(next.tiles[1 * 3 + 2]).toBe(WATER)
  })

  it('last update wins for duplicate coordinates', () => {
    const next = applyCommand(makeMap(), {
      kind: 'setTiles',
      updates: [
        { x: 1, y: 1, tile: FLOOR },
        { x: 1, y: 1, tile: WATER },
      ],
    })

    expect(next.tiles[1 * 3 + 1]).toBe(WATER)
  })

  it('empty batch is a no-op and returns the same model', () => {
    const source = makeMap()
    const next = applyCommand(source, { kind: 'setTiles', updates: [] })

    expect(next).toBe(source)
  })

  it('writing identical values is a no-op and returns the same model', () => {
    const source = applyCommand(makeMap(), { kind: 'setTile', x: 0, y: 0, tile: FLOOR })
    const next = applyCommand(source, {
      kind: 'setTiles',
      updates: [
        { x: 0, y: 0, tile: FLOOR },
        { x: 1, y: 1, tile: 0 },
      ],
    })

    expect(next).toBe(source)
  })

  it.each([
    { kind: 'setTile', x: 3, y: 0, tile: FLOOR },
    { kind: 'setTile', x: -1, y: 0, tile: FLOOR },
    { kind: 'setTile', x: 0.5, y: 0, tile: FLOOR },
    { kind: 'setTile', x: 0, y: 3, tile: FLOOR },
    { kind: 'setTile', x: 0, y: -1, tile: FLOOR },
    { kind: 'setTile', x: 0, y: 0.5, tile: FLOOR },
    { kind: 'setTile', x: 0, y: 0, tile: -1 },
    { kind: 'setTile', x: 0, y: 0, tile: TILE_TYPES.length },
    { kind: 'setTile', x: 0, y: 0, tile: 1.5 },
  ] satisfies Command[])('rejects out-of-range setTile %o', (command) => {
    expect(() => applyCommand(makeMap(), command)).toThrow(RangeError)
  })

  it('rejects out-of-range updates inside a batch without partial application', () => {
    const source = makeMap()

    expect(() =>
      applyCommand(source, {
        kind: 'setTiles',
        updates: [
          { x: 0, y: 0, tile: FLOOR },
          { x: 99, y: 99, tile: FLOOR },
        ],
      }),
    ).toThrow(RangeError)

    for (const tile of source.tiles) {
      expect(tile).toBe(0)
    }
  })
})
