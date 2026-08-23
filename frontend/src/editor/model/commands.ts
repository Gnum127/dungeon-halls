import { findObjectById, isCellOccupied, isKnownKind, nextObjectId } from './objects'
import { TILE_TYPES } from './types'
import type { MapModel, TileValue } from './types'

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
  }
}
