import { findObjectById, isCellOccupied, isKnownKind, nextObjectId } from './objects'
import { MAX_MAP_DIMENSION, TILE_TYPES } from './types'
import type { MapModel, TileGrid, TileValue } from './types'

export interface TileUpdate {
  readonly x: number
  readonly y: number
  readonly tile: TileValue
}

export type Command =
  | { readonly kind: 'setTile'; readonly x: number; readonly y: number; readonly tile: TileValue }
  | { readonly kind: 'setTiles'; readonly updates: readonly TileUpdate[] }
  | { readonly kind: 'addObject'; readonly x: number; readonly y: number; readonly kindId: string }
  | { readonly kind: 'moveObject'; readonly id: number; readonly x: number; readonly y: number }
  | { readonly kind: 'removeObject'; readonly id: number }
  | {
      readonly kind: 'replaceMap'
      readonly width: number
      readonly height: number
      readonly tiles: TileGrid | readonly TileValue[]
    }

function assertValidUpdate(update: TileUpdate, model: MapModel): void {
  const { x, y, tile } = update
  if (!Number.isInteger(x) || x < 0 || x >= model.width) {
    throw new RangeError(`Tile x must be an integer in [0, ${model.width}), got ${x}`)
  }
  if (!Number.isInteger(y) || y < 0 || y >= model.height) {
    throw new RangeError(`Tile y must be an integer in [0, ${model.height}), got ${y}`)
  }
  if (!Number.isInteger(tile) || tile < 0 || tile >= TILE_TYPES.length) {
    throw new RangeError(`Tile value must be an integer in [0, ${TILE_TYPES.length}), got ${tile}`)
  }
}

function assertInside(model: MapModel, x: number, y: number): void {
  if (!Number.isInteger(x) || x < 0 || x >= model.width) {
    throw new RangeError(`Cell x must be an integer in [0, ${model.width}), got ${x}`)
  }
  if (!Number.isInteger(y) || y < 0 || y >= model.height) {
    throw new RangeError(`Cell y must be an integer in [0, ${model.height}), got ${y}`)
  }
}

function applyTiles(model: MapModel, updates: readonly TileUpdate[]): MapModel {
  for (const update of updates) {
    assertValidUpdate(update, model)
  }

  // Copy-on-write: запись идентичного значения не считается изменением,
  // чтобы no-op штрихи кисти не создавали записи в истории.
  if (!updates.some(({ x, y, tile }) => model.tiles[y * model.width + x] !== tile)) {
    return model
  }

  const tiles = new Uint8Array(model.tiles)
  for (const { x, y, tile } of updates) {
    tiles[y * model.width + x] = tile
  }

  return { ...model, tiles }
}

function addObject(model: MapModel, x: number, y: number, kindId: string): MapModel {
  assertInside(model, x, y)
  if (!isKnownKind(kindId)) {
    throw new RangeError(`Unknown object kind: ${kindId}`)
  }
  if (isCellOccupied(model.objects, x, y)) {
    throw new RangeError(`Cell (${x}, ${y}) is already occupied`)
  }
  const object = { id: nextObjectId(model.objects), kindId, x, y }
  return { ...model, objects: [...model.objects, object] }
}

function moveObject(model: MapModel, id: number, x: number, y: number): MapModel {
  assertInside(model, x, y)
  const object = findObjectById(model.objects, id)
  if (!object) {
    throw new RangeError(`Object ${id} not found`)
  }
  if (object.x === x && object.y === y) {
    return model
  }
  if (isCellOccupied(model.objects, x, y)) {
    throw new RangeError(`Cell (${x}, ${y}) is already occupied`)
  }
  const moved = { ...object, x, y }
  return {
    ...model,
    objects: model.objects.map((candidate) => (candidate.id === id ? moved : candidate)),
  }
}

function removeObject(model: MapModel, id: number): MapModel {
  const object = findObjectById(model.objects, id)
  if (!object) {
    throw new RangeError(`Object ${id} not found`)
  }
  return { ...model, objects: model.objects.filter((candidate) => candidate.id !== id) }
}

function tilesEqual(a: TileGrid, b: TileGrid): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Полная замена документа (результат генерации): одна запись истории —
 * undo возвращает прежнюю карту вместе с объектами. Объекты при замене
 * очищаются атомарно: их координаты не переживают смену размеров/сеток.
 */
function replaceMap(
  model: MapModel,
  width: number,
  height: number,
  tiles: TileGrid | readonly TileValue[],
): MapModel {
  if (!Number.isInteger(width) || width < 1 || width > MAX_MAP_DIMENSION) {
    throw new RangeError(`width must be an integer in [1, ${MAX_MAP_DIMENSION}], got ${width}`)
  }
  if (!Number.isInteger(height) || height < 1 || height > MAX_MAP_DIMENSION) {
    throw new RangeError(`height must be an integer in [1, ${MAX_MAP_DIMENSION}], got ${height}`)
  }
  // Принимаем и обычный массив, и Uint8Array от генератора.
  if (tiles == null || typeof tiles.length !== 'number' || tiles.length !== width * height) {
    throw new RangeError(`tiles must contain exactly ${width * height} values`)
  }
  for (const tile of tiles) {
    if (!Number.isInteger(tile) || tile < 0 || tile >= TILE_TYPES.length) {
      throw new RangeError(
        `Tile value must be an integer in [0, ${TILE_TYPES.length}), got ${tile}`,
      )
    }
  }

  const nextTiles = Uint8Array.from(tiles)
  const identical =
    model.width === width &&
    model.height === height &&
    model.objects.length === 0 &&
    tilesEqual(model.tiles, nextTiles)

  // No-op только при полностью идентичном документе: если сетка совпала,
  // но есть объекты — замена нужна, чтобы их атомарно убрать.
  if (identical) return model

  return { ...model, width, height, tiles: nextTiles, objects: [] }
}

export function applyCommand(model: MapModel, command: Command): MapModel {
  switch (command.kind) {
    case 'setTile':
      return applyTiles(model, [{ x: command.x, y: command.y, tile: command.tile }])
    case 'setTiles':
      return applyTiles(model, command.updates)
    case 'addObject':
      return addObject(model, command.x, command.y, command.kindId)
    case 'moveObject':
      return moveObject(model, command.id, command.x, command.y)
    case 'removeObject':
      return removeObject(model, command.id)
    case 'replaceMap':
      return replaceMap(model, command.width, command.height, command.tiles)
  }
}
