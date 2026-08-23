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

export function applyCommand(model: MapModel, command: Command): MapModel {
  const updates =
    command.kind === 'setTile' ? [{ x: command.x, y: command.y, tile: command.tile }] : command.updates

  for (const update of updates) {
    assertValidUpdate(update, model)
  }

  const tiles = new Uint8Array(model.tiles)
  for (const { x, y, tile } of updates) {
    tiles[y * model.width + x] = tile
  }

  return { ...model, tiles }
}
