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

  it('addObject with scale places a multi-cell object', () => {
    const model = makeMap()
    const next = applyCommand(model, {
      kind: 'addObject',
      x: 0,
      y: 0,
      kindId: DOOR_KIND,
      scale: { w: 2, h: 2 },
    })
    expect(next.objects).toHaveLength(1)
    expect(next.objects[0]).toMatchObject({ id: 1, x: 0, y: 0, scale: { w: 2, h: 2 } })
  })

  it('addObject with scale rejects if footprint exceeds map bounds', () => {
    const model = makeMap() // 3×3
    expect(() =>
      applyCommand(model, {
        kind: 'addObject',
        x: 2,
        y: 0,
        kindId: DOOR_KIND,
        scale: { w: 2, h: 1 },
      }),
    ).toThrow(RangeError)
    expect(() =>
      applyCommand(model, {
        kind: 'addObject',
        x: 0,
        y: 2,
        kindId: DOOR_KIND,
        scale: { w: 1, h: 2 },
      }),
    ).toThrow(RangeError)
  })

  it('addObject with scale rejects if footprint overlaps another object', () => {
    const model = withObject(makeMap(), 1, 1, 5) // 1×1 at (1,1)
    expect(() =>
      applyCommand(model, {
        kind: 'addObject',
        x: 0,
        y: 0,
        kindId: DOOR_KIND,
        scale: { w: 2, h: 2 },
      }),
    ).toThrow(RangeError)
  })

  it('addObject with rotation stores rotation', () => {
    const next = applyCommand(makeMap(), {
      kind: 'addObject',
      x: 0,
      y: 0,
      kindId: DOOR_KIND,
      rotation: 90,
    })
    expect(next.objects[0]).toMatchObject({ rotation: 90 })
  })

  it('moveObject moves multi-cell object and validates footprint at destination', () => {
    let model = makeMap()
    model = applyCommand(model, {
      kind: 'addObject',
      x: 0,
      y: 0,
      kindId: DOOR_KIND,
      scale: { w: 2, h: 2 },
    })
    model = withObject(model, 2, 0, 99) // 1×1 at (2,0)
    const next = applyCommand(model, { kind: 'moveObject', id: 1, x: 0, y: 1 })
    expect(next.objects.find((o) => o.id === 1)).toMatchObject({ x: 0, y: 1 })
  })

  it('moveObject with scale rejects if destination footprint overlaps', () => {
    let model = makeMap()
    model = applyCommand(model, {
      kind: 'addObject',
      x: 0,
      y: 0,
      kindId: DOOR_KIND,
      scale: { w: 2, h: 2 },
    })
    model = withObject(model, 2, 0, 99) // 1×1 at (2,0) — not overlapping (0,0,2,2)
    expect(() =>
      applyCommand(model, { kind: 'moveObject', id: 1, x: 1, y: 0 }),
    ).toThrow(RangeError) // (1,0,2,2) overlaps (2,0,1,1)
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

describe('setGridType', () => {
  it('changes only the gridType keeping tiles and objects', () => {
    const source = withObject(makeMap(), 1, 1, 1)
    const next = applyCommand(source, { kind: 'setGridType', gridType: 'hex-pointy' })

    expect(next).not.toBe(source)
    expect(next.gridType).toBe('hex-pointy')
    expect([...next.tiles]).toEqual([...source.tiles])
    expect(next.objects).toEqual(source.objects)
  })

  it('is a no-op when the gridType is unchanged', () => {
    const source = applyCommand(makeMap(), { kind: 'setGridType', gridType: 'hex-flat' })
    const next = applyCommand(source, { kind: 'setGridType', gridType: 'hex-flat' })

    expect(next).toBe(source)
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

  it('defaults gridType to square when omitted', () => {
    const next = applyCommand(makeMap(), {
      kind: 'replaceMap',
      width: 2,
      height: 2,
      tiles: [FLOOR, FLOOR, FLOOR, FLOOR],
    })

    expect(next.gridType).toBe('square')
  })

  it('accepts explicit gridType in the payload', () => {
    const next = applyCommand(makeMap(), {
      kind: 'replaceMap',
      width: 2,
      height: 2,
      tiles: [FLOOR, FLOOR, FLOOR, FLOOR],
      gridType: 'hex-flat',
    })

    expect(next.gridType).toBe('hex-flat')
  })

  it('gridType participates in the no-op predicate', () => {
    // Та же сетка, но другой gridType → замена выполняется.
    const next = applyCommand(makeMap(), {
      kind: 'replaceMap',
      width: 3,
      height: 3,
      tiles: new Array<number>(9).fill(0),
      gridType: 'hex-pointy',
    })

    expect(next.gridType).toBe('hex-pointy')

    // Полностью идентичный документ (включая gridType) → no-op.
    const source = applyCommand(makeMap(), {
      kind: 'replaceMap',
      width: 2,
      height: 2,
      tiles: new Array<number>(4).fill(FLOOR),
      gridType: 'hex-flat',
    })
    const sameAgain = applyCommand(source, {
      kind: 'replaceMap',
      width: 2,
      height: 2,
      tiles: [1, 1, 1, 1],
      gridType: 'hex-flat',
    })
    expect(sameAgain).toBe(source)
  })
})

describe('setWalls / toggleWall', () => {
  it('adds and removes walls, normalizing shared edges', () => {
    let model = applyCommand(makeMap(), { kind: 'toggleWall', edge: { x: 0, y: 0, side: 'E' } })
    // E внутренней клетки канонизируется в W соседа.
    expect(model.walls).toEqual([{ x: 1, y: 0, side: 'W' }])

    model = applyCommand(model, { kind: 'toggleWall', edge: { x: 2, y: 2, side: 'E' } })
    // Периметр хранится как есть.
    expect(model.walls[1]).toEqual({ x: 2, y: 2, side: 'E' })

    model = applyCommand(model, { kind: 'toggleWall', edge: { x: 1, y: 0, side: 'W' } })
    expect(model.walls).toHaveLength(1)
  })

  it('deduplicates repeated additions in one batch (no-op returns same model)', () => {
    const source = makeMap()
    const next = applyCommand(source, {
      kind: 'setWalls',
      updates: [
        { edge: { x: 0, y: 0, side: 'E' }, present: true },
        { edge: { x: 1, y: 0, side: 'W' }, present: true },
      ],
    })
    expect(next.walls).toEqual([{ x: 1, y: 0, side: 'W' }])
  })

  it('is a no-op when every update matches the current state', () => {
    const source = applyCommand(makeMap(), { kind: 'toggleWall', edge: { x: 1, y: 1, side: 'N' } })
    const next = applyCommand(source, {
      kind: 'setWalls',
      updates: [{ edge: { x: 1, y: 1, side: 'N' }, present: true }],
    })
    expect(next).toBe(source)
  })

  it('rejects out-of-bounds edges', () => {
    expect(() =>
      applyCommand(makeMap(), { kind: 'toggleWall', edge: { x: 4, y: 0, side: 'W' } }),
    ).toThrow(RangeError)
    expect(() =>
      applyCommand(makeMap(), {
        kind: 'setWalls',
        updates: [{ edge: { x: -1, y: 0, side: 'N' }, present: true }],
      }),
    ).toThrow(/bounds/)
  })

  it('removing a wall cascades its door away in the same entry', () => {
    let model = applyCommand(makeMap(), { kind: 'toggleWall', edge: { x: 1, y: 0, side: 'W' } })
    model = applyCommand(model, { kind: 'addDoor', edge: { x: 1, y: 0, side: 'W' } })
    expect(model.doors).toHaveLength(1)

    model = applyCommand(model, { kind: 'toggleWall', edge: { x: 1, y: 0, side: 'W' } })
    expect(model.walls).toEqual([])
    expect(model.doors).toEqual([])
  })
})

describe('doors', () => {
  function mapWithWall(): MapModel {
    return applyCommand(makeMap(), { kind: 'toggleWall', edge: { x: 1, y: 0, side: 'W' } })
  }

  it('requires an existing wall', () => {
    expect(() =>
      applyCommand(makeMap(), { kind: 'addDoor', edge: { x: 2, y: 2, side: 'N' } }),
    ).toThrow(/existing wall/)
  })

  it('allows only one door per edge', () => {
    const withDoor = applyCommand(mapWithWall(), {
      kind: 'addDoor',
      edge: { x: 1, y: 0, side: 'W' },
    })
    expect(() =>
      applyCommand(withDoor, { kind: 'addDoor', edge: { x: 1, y: 0, side: 'W' } }),
    ).toThrow(/already has a door/)
  })

  it('toggles open state and no-ops on identical state', () => {
    let model = applyCommand(mapWithWall(), { kind: 'addDoor', edge: { x: 1, y: 0, side: 'W' } })
    model = applyCommand(model, { kind: 'setDoorOpen', id: 1, open: true })
    expect(model.doors[0]?.open).toBe(true)
    expect(applyCommand(model, { kind: 'setDoorOpen', id: 1, open: true })).toBe(model)

    model = applyCommand(model, { kind: 'removeDoor', id: 1 })
    expect(model.doors).toEqual([])
    expect(() => applyCommand(model, { kind: 'removeDoor', id: 1 })).toThrow(/not found/)
  })
})

describe('setGridType with walls/doors', () => {
  it('is forbidden while walls or doors exist', () => {
    let model = applyCommand(makeMap(), { kind: 'toggleWall', edge: { x: 1, y: 0, side: 'W' } })
    model = applyCommand(model, { kind: 'addDoor', edge: { x: 1, y: 0, side: 'W' } })

    expect(applyCommand(model, { kind: 'setGridType', gridType: 'hex-pointy' })).toBe(model)
  })
})

describe('walls interactions with replaceMap and immutability', () => {
  function walledMapWithDoor(): MapModel {
    let model = applyCommand(makeMap(), { kind: 'toggleWall', edge: { x: 1, y: 0, side: 'W' } })
    model = applyCommand(model, { kind: 'addDoor', edge: { x: 1, y: 0, side: 'W' } })
    return model
  }

  it('replaceMap clears walls and doors atomically with objects', () => {
    const source = walledMapWithDoor()
    const next = applyCommand(source, {
      kind: 'replaceMap',
      width: 2,
      height: 2,
      tiles: [FLOOR, FLOOR, 0, WATER],
    })

    expect(next.walls).toEqual([])
    expect(next.doors).toEqual([])
    expect(next.width).toBe(2)
  })

  it('replaceMap no longer no-ops while walls exist even on identical grid', () => {
    const source = applyCommand(makeMap(), { kind: 'toggleWall', edge: { x: 1, y: 1, side: 'N' } })
    const sameGridTiles = [...source.tiles]

    const next = applyCommand(source, {
      kind: 'replaceMap',
      width: source.width,
      height: source.height,
      tiles: sameGridTiles,
    })
    // Замена нужна, чтобы атомарно убрать стены.
    expect(next).not.toBe(source)
    expect(next.walls).toEqual([])
  })

  it('does not mutate the source model', () => {
    const source = walledMapWithDoor()
    const snapshot = {
      walls: source.walls,
      doors: source.doors,
    }

    applyCommand(source, { kind: 'toggleWall', edge: { x: 1, y: 0, side: 'W' } })
    applyCommand(source, {
      kind: 'setWalls',
      updates: [
        { edge: { x: 0, y: 0, side: 'N' }, present: true },
        { edge: { x: 1, y: 0, side: 'W' }, present: false },
      ],
    })

    expect(source.walls).toEqual(snapshot.walls)
    expect(source.doors).toEqual(snapshot.doors)
  })

  it('batch removal of several walls cascades all their doors at once', () => {
    let model = applyCommand(makeMap(), {
      kind: 'setWalls',
      updates: [
        { edge: { x: 0, y: 0, side: 'N' }, present: true },
        { edge: { x: 1, y: 2, side: 'N' }, present: true },
        { edge: { x: 2, y: 2, side: 'N' }, present: true },
      ],
    })
    model = applyCommand(model, { kind: 'addDoor', edge: { x: 0, y: 0, side: 'N' } })
    model = applyCommand(model, { kind: 'addDoor', edge: { x: 1, y: 2, side: 'N' } })
    expect(model.doors).toHaveLength(2)

    model = applyCommand(model, {
      kind: 'setWalls',
      updates: [
        { edge: { x: 0, y: 0, side: 'N' }, present: false },
        { edge: { x: 1, y: 2, side: 'N' }, present: false },
      ],
    })
    expect(model.walls).toEqual([{ x: 2, y: 2, side: 'N' }])
    expect(model.doors).toEqual([])
  })
})
