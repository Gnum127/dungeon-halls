import { describe, expect, it } from 'vitest'
import { applyCommand } from './commands'
import type { Command } from './commands'
import { createEmptyMap } from './createEmptyMap'
import { OBJECT_KINDS } from './objects'
import { MAX_MAP_DIMENSION, TILE_TYPES } from './types'
import type { MapModel, MapObject } from './types'

function makeMap(): MapModel {
  return createEmptyMap(3, 3)
}

const FLOOR = TILE_TYPES.indexOf('floor')
const WATER = TILE_TYPES.indexOf('water')
const DOOR_KIND = OBJECT_KINDS[0]
const STAIRS_KIND = OBJECT_KINDS[1]

function withObject(model: MapModel, x: number, y: number, id: number): MapModel {
  const object: MapObject = { id, kindId: DOOR_KIND, x, y }
  return { ...model, objects: [...model.objects, object] }
}

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

describe('object commands', () => {
  it('addObject appends an object with an incremental id', () => {
    const first = applyCommand(makeMap(), { kind: 'addObject', x: 0, y: 0, kindId: DOOR_KIND })

    expect(first.objects).toHaveLength(1)
    expect(first.objects[0]).toMatchObject({ id: 1, x: 0, y: 0, kindId: DOOR_KIND })

    const second = applyCommand(first, {
      kind: 'addObject',
      x: 2,
      y: 2,
      kindId: STAIRS_KIND,
    })
    expect(second.objects).toHaveLength(2)
    expect(second.objects[1]?.id).toBe(2)
    expect(first.objects).toHaveLength(1)
  })

  it('addObject rejects occupied cells, outside cells and unknown kinds', () => {
    const model = withObject(makeMap(), 1, 1, 5)

    expect(() => applyCommand(model, { kind: 'addObject', x: 1, y: 1, kindId: DOOR_KIND })).toThrow(
      RangeError,
    )
    expect(() => applyCommand(model, { kind: 'addObject', x: 3, y: 0, kindId: DOOR_KIND })).toThrow(
      RangeError,
    )
    expect(() => applyCommand(model, { kind: 'addObject', x: 0, y: 0, kindId: 'dragon' })).toThrow(
      RangeError,
    )
  })

  it('moveObject moves the object and keeps its id and order', () => {
    const model = withObject(withObject(makeMap(), 0, 0, 1), 2, 2, 2)
    const next = applyCommand(model, { kind: 'moveObject', id: 1, x: 1, y: 1 })

    expect(next.objects[0]).toMatchObject({ id: 1, x: 1, y: 1 })
    expect(next.objects[1]).toMatchObject({ id: 2, x: 2, y: 2 })
  })

  it('moveObject to the same position is a no-op returning the same model', () => {
    const model = withObject(makeMap(), 1, 1, 1)
    const next = applyCommand(model, { kind: 'moveObject', id: 1, x: 1, y: 1 })

    expect(next).toBe(model)
  })

  it('moveObject rejects missing objects and occupied targets', () => {
    const model = withObject(withObject(makeMap(), 0, 0, 1), 2, 2, 2)

    expect(() => applyCommand(model, { kind: 'moveObject', id: 9, x: 1, y: 1 })).toThrow(RangeError)
    expect(() => applyCommand(model, { kind: 'moveObject', id: 1, x: 2, y: 2 })).toThrow(RangeError)
    expect(() => applyCommand(model, { kind: 'moveObject', id: 1, x: -1, y: 0 })).toThrow(
      RangeError,
    )
  })

  it('removeObject drops only the target object immutably', () => {
    const model = withObject(withObject(makeMap(), 0, 0, 1), 2, 2, 2)
    const next = applyCommand(model, { kind: 'removeObject', id: 1 })

    expect(next.objects).toHaveLength(1)
    expect(next.objects[0]?.id).toBe(2)
    expect(model.objects).toHaveLength(2)

    expect(() => applyCommand(next, { kind: 'removeObject', id: 1 })).toThrow(RangeError)
  })
})

describe('replaceMap', () => {
  it('replaces dimensions, tiles and clears objects atomically', () => {
    const source = withObject(withObject(makeMap(), 0, 0, 1), 2, 2, 2)
    const next = applyCommand(source, {
      kind: 'replaceMap',
      width: 2,
      height: 3,
      tiles: [FLOOR, FLOOR, 0, 0, WATER, WATER],
    })

    expect(next.width).toBe(2)
    expect(next.height).toBe(3)
    expect(next.objects).toEqual([])
    expect([...next.tiles]).toEqual([FLOOR, FLOOR, 0, 0, WATER, WATER])

    // Источник не тронут.
    expect(source.width).toBe(3)
    expect(source.objects).toHaveLength(2)
  })

  it('accepts Uint8Array as tiles payload', () => {
    const next = applyCommand(makeMap(), {
      kind: 'replaceMap',
      width: 2,
      height: 2,
      tiles: Uint8Array.from([WATER, 0, 0, WATER]),
    })

    expect(next.width).toBe(2)
    expect(next.tiles[0]).toBe(WATER)
  })

  it('is a no-op when the resulting document is identical', () => {
    const source = makeMap()
    const next = applyCommand(source, {
      kind: 'replaceMap',
      width: 3,
      height: 3,
      tiles: new Array<number>(9).fill(0),
    })

    expect(next).toBe(source)
  })

  it('replaces even when the grid matches but objects exist', () => {
    const source = withObject(makeMap(), 1, 1, 1)
    const next = applyCommand(source, {
      kind: 'replaceMap',
      width: 3,
      height: 3,
      tiles: [...source.tiles],
    })

    expect(next).not.toBe(source)
    expect([...next.tiles]).toEqual([...source.tiles])
    expect(next.objects).toEqual([])
  })

  it('rejects invalid dimensions before any mutation', () => {
    const source = makeMap()

    for (const width of [0, -1, 2.5, Number.NaN, MAX_MAP_DIMENSION + 1]) {
      expect(() =>
        applyCommand(source, { kind: 'replaceMap', width, height: 3, tiles: [] }),
      ).toThrow(RangeError)
    }
    for (const height of [0, -1, 2.5, Number.NaN, MAX_MAP_DIMENSION + 1]) {
      expect(() =>
        applyCommand(source, { kind: 'replaceMap', width: 3, height, tiles: [] }),
      ).toThrow(RangeError)
    }
  })

  it('rejects wrong tiles length and out-of-range values', () => {
    const source = makeMap()

    expect(() =>
      applyCommand(source, { kind: 'replaceMap', width: 3, height: 3, tiles: [0] }),
    ).toThrow(/exactly 9/)
    expect(() =>
      applyCommand(source, {
        kind: 'replaceMap',
        width: 3,
        height: 3,
        tiles: [0, 0, 0, 0, 0, 0, 0, 0, TILE_TYPES.length],
      }),
    ).toThrow(RangeError)
  })
})
