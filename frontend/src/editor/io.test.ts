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
    expect(parsed.version).toBe(2)
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

    expect(restored.version).toBe(2)
    expect(restored.gridType).toBe('square')
    expect([...restored.tiles]).toEqual([...makeRichModel().tiles])
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
