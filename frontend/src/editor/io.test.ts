import { describe, expect, it } from 'vitest'
import { applyCommand } from './model/commands'
import { createEmptyMap } from './model/createEmptyMap'
import { MAX_MAP_DIMENSION, TILE_TYPES } from './model/types'
import type { MapModel } from './model/types'
import { deserializeMap, MapLoadError, serializeMap } from './io'

const FLOOR = TILE_TYPES.indexOf('floor')

function makeRichModel(): MapModel {
  let model = applyCommand(createEmptyMap(4, 3), {
    kind: 'setTiles',
    updates: [
      { x: 0, y: 0, tile: FLOOR },
      { x: 3, y: 2, tile: TILE_TYPES.indexOf('water') },
    ],
  })
  model = applyCommand(model, { kind: 'addObject', x: 1, y: 1, kindId: 'chest' })
  return model
}

function expectMapLoadError(json: unknown): void {
  const raw = typeof json === 'string' ? json : JSON.stringify(json)
  expect(() => deserializeMap(raw)).toThrow(MapLoadError)
}

describe('serializeMap / deserializeMap roundtrip', () => {
  it('preserves the full model and produces plain JSON', () => {
    const model = makeRichModel()
    const json = serializeMap(model)

    const parsed = JSON.parse(json) as Record<string, unknown>
    expect(parsed.version).toBe(3)
    expect(Array.isArray(parsed.tiles)).toBe(true)

    const restored = deserializeMap(json)
    expect(restored.width).toBe(model.width)
    expect(restored.height).toBe(model.height)
    expect([...restored.tiles]).toEqual([...model.tiles])
    expect(restored.objects).toEqual(model.objects)
    expect(restored.tiles).not.toBe(model.tiles)
  })

  it('accepts the maximum map dimension', () => {
    const model = createEmptyMap(MAX_MAP_DIMENSION, 1)
    const restored = deserializeMap(serializeMap(model))
    expect(restored.width).toBe(MAX_MAP_DIMENSION)
  })
})

describe('deserializeMap validation', () => {
  it('rejects broken JSON', () => {
    expect(() => deserializeMap('{oops')).toThrow(MapLoadError)
  })

  it.each([[[]], ['string'], [null], [42]])('rejects non-object root %j', (root) => {
    expectMapLoadError(root)
  })

  it('rejects unsupported versions', () => {
    const raw = JSON.parse(serializeMap(makeRichModel())) as Record<string, unknown>
    raw.version = 99
    expect(() => deserializeMap(JSON.stringify(raw))).toThrow(/Unsupported map version/)
  })

  it('migrates version 1 by adding square gridType', () => {
    const raw = JSON.parse(serializeMap(makeRichModel())) as Record<string, unknown>
    raw.version = 1
    delete raw.gridType

    const restored = deserializeMap(JSON.stringify(raw))

    expect(restored.version).toBe(3)
    expect(restored.gridType).toBe('square')
    expect([...restored.tiles]).toEqual([...makeRichModel().tiles])
  })

  // Миграция v2 → v3 транзитивна: старые файлы читаются, walls/doors пустые.
  it('migrates version 2 with empty walls and doors', () => {
    const raw = JSON.parse(serializeMap(makeRichModel())) as Record<string, unknown>
    raw.version = 2

    const restored = deserializeMap(JSON.stringify(raw))

    expect(restored.version).toBe(3)
    expect(restored.walls).toEqual([])
    expect(restored.doors).toEqual([])
    expect(restored.objects).toEqual(makeRichModel().objects)
  })

  it('rejects unknown gridType values', () => {
    const raw = JSON.parse(serializeMap(makeRichModel())) as Record<string, unknown>
    raw.gridType = 'hex-weird'
    expect(() => deserializeMap(JSON.stringify(raw))).toThrow(/Unknown gridType/)
  })

  it.each([0, -3, 2.5, MAX_MAP_DIMENSION + 1])('rejects invalid width %s', (width) => {
    const raw = JSON.parse(serializeMap(createEmptyMap(4, 3))) as Record<string, unknown>
    raw.width = width
    expectMapLoadError(JSON.stringify(raw))
  })

  it.each([0, -1, 2.5, MAX_MAP_DIMENSION + 1])('rejects invalid height %s', (height) => {
    const raw = JSON.parse(serializeMap(createEmptyMap(4, 3))) as Record<string, unknown>
    raw.height = height
    expectMapLoadError(JSON.stringify(raw))
  })

  it('rejects wrong tiles length', () => {
    const raw = JSON.parse(serializeMap(makeRichModel())) as Record<string, unknown>
    raw.tiles = [0]
    expectMapLoadError(JSON.stringify(raw))
  })

  it.each([-1, 1.5, 'floor', TILE_TYPES.length])('rejects out-of-range tile value %j', (tile) => {
    const raw = JSON.parse(serializeMap(makeRichModel())) as Record<string, unknown>
    ;(raw.tiles as unknown[])[0] = tile
    expectMapLoadError(JSON.stringify(raw))
  })

  it('rejects objects that are not an array', () => {
    const raw = JSON.parse(serializeMap(makeRichModel())) as Record<string, unknown>
    raw.objects = {}
    expectMapLoadError(JSON.stringify(raw))
  })

  function withObjects(objects: unknown[]): string {
    const raw = JSON.parse(serializeMap(createEmptyMap(4, 4))) as Record<string, unknown>
    raw.objects = objects
    return JSON.stringify(raw)
  }

  it('rejects malformed object entries', () => {
    expectMapLoadError(withObjects([null]))
    expectMapLoadError(withObjects([{ id: 0, kindId: 'door', x: 0, y: 0 }]))
    expectMapLoadError(withObjects([{ id: 1.5, kindId: 'door', x: 0, y: 0 }]))
    expectMapLoadError(withObjects([{ id: -1, kindId: 'door', x: 0, y: 0 }]))
    expectMapLoadError(withObjects([{ id: Number.MAX_SAFE_INTEGER, kindId: 'door', x: 0, y: 0 }]))
    expectMapLoadError(withObjects([{ id: 1, kindId: 'dragon', x: 0, y: 0 }]))
    expectMapLoadError(withObjects([{ id: 1, kindId: 'door', x: 9, y: 0 }]))
    expectMapLoadError(withObjects([{ id: 1, kindId: 'door', x: 0.5, y: 0 }]))
  })

  it('accepts the highest valid object id', () => {
    const maxSafe = Number.MAX_SAFE_INTEGER - 1
    const model = deserializeMap(withObjects([{ id: maxSafe, kindId: 'door', x: 0, y: 0 }]))
    expect(model.objects[0]?.id).toBe(maxSafe)
  })

  it('rejects duplicate ids and overlapping cells', () => {
    expectMapLoadError(
      withObjects([
        { id: 1, kindId: 'door', x: 0, y: 0 },
        { id: 1, kindId: 'stairs', x: 2, y: 2 },
      ]),
    )
    expectMapLoadError(
      withObjects([
        { id: 1, kindId: 'door', x: 0, y: 0 },
        { id: 2, kindId: 'stairs', x: 0, y: 0 },
      ]),
    )
  })
})

describe('walls and doors serialization (v3)', () => {
  function makeWalledModel(): MapModel {
    // Внутреннее ребро + периметровые E/S рёбра + дверь в открытом состоянии.
    let model = applyCommand(createEmptyMap(4, 4), {
      kind: 'setWalls',
      updates: [
        { edge: { x: 1, y: 2, side: 'N' }, present: true },
        { edge: { x: 3, y: 1, side: 'E' }, present: true },
        { edge: { x: 2, y: 3, side: 'S' }, present: true },
      ],
    })
    model = applyCommand(model, { kind: 'addDoor', edge: { x: 1, y: 2, side: 'N' } })
    return applyCommand(model, { kind: 'setDoorOpen', id: 1, open: true })
  }

  it('roundtrips non-empty walls including perimeter edges and an open door', () => {
    const model = makeWalledModel()
    const restored = deserializeMap(serializeMap(model))

    expect(restored.version).toBe(3)
    expect(restored.walls).toEqual(model.walls)
    expect(restored.doors).toEqual(model.doors)
    expect(restored.doors[0]?.open).toBe(true)
  })

  it('rejects broken walls and doors', () => {
    const withPayload = (walls: unknown[], doors: unknown[]): string => {
      const raw = JSON.parse(serializeMap(createEmptyMap(4, 4))) as Record<string, unknown>
      raw.walls = walls
      raw.doors = doors
      return JSON.stringify(raw)
    }
    const wall = { x: 1, y: 1, side: 'N' }
    const perimeter = { x: 3, y: 1, side: 'E' }

    // walls/doors не массивы.
    const notArray = JSON.parse(serializeMap(createEmptyMap(4, 4))) as Record<string, unknown>
    notArray.walls = {}
    expectMapLoadError(JSON.stringify(notArray))
    const doorsNotArray = JSON.parse(
      serializeMap(deserializeMap(withPayload([wall], []))),
    ) as Record<string, unknown>
    doorsNotArray.doors = 'nope'
    expectMapLoadError(JSON.stringify(doorsNotArray))

    // Битые записи стен.
    expectMapLoadError(withPayload([null], []))
    expectMapLoadError(withPayload([{ x: -1, y: 1, side: 'N' }], []))
    expectMapLoadError(withPayload([{ x: 1.5, y: 1, side: 'N' }], []))
    expectMapLoadError(withPayload([{ x: 1, y: 1, side: 'X' }], []))
    // Не-каноничное ребро (E внутренней клетки) и дубликат ребра.
    expectMapLoadError(withPayload([{ x: 0, y: 1, side: 'E' }], []))
    expectMapLoadError(withPayload([wall, wall], []))
    // Стены на гексах запрещены.
    const hexRaw = JSON.parse(
      serializeMap(createEmptyMap(4, 4, 'hex-pointy')),
    ) as Record<string, unknown>
    hexRaw.walls = [perimeter]
    hexRaw.doors = []
    expectMapLoadError(JSON.stringify(hexRaw))

    // Битые записи дверей: не-boolean open, ребро без стены, дубликаты.
    expectMapLoadError(withPayload([wall], [{ id: 1, edge: wall, open: 'yes' }]))
    expectMapLoadError(withPayload([wall], [{ id: 1, edge: { x: 2, y: 2, side: 'N' }, open: false }]))
    expectMapLoadError(withPayload([], [{ id: 1, edge: wall, open: false }]))
    expectMapLoadError(
      withPayload([wall], [
        { id: 1, edge: wall, open: false },
        { id: 1, edge: wall, open: true },
      ]),
    )
    expectMapLoadError(
      withPayload([wall], [
        { id: 1, edge: wall, open: false },
        { id: 2, edge: wall, open: false },
      ]),
    )
  })
})
