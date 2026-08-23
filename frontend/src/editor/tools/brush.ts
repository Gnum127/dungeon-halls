import type { Command } from '../model/commands'
import { TILE_TYPES } from '../model/types'
import type { MapModel, TileValue } from '../model/types'

export interface Cell {
  readonly x: number
  readonly y: number
}

export function isInsideMap(model: MapModel, x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    x < model.width &&
    y >= 0 &&
    y < model.height
  )
}

/**
 * Собирает штрих в одну команду. Клетки вне карты отбрасываются,
 * повторы разрешаются в пользу последнего значения.
 * Возвращает null, если после фильтрации не осталось ни одной клетки.
 */
export function commitStroke(
  model: MapModel,
  cells: readonly Cell[],
  tile: TileValue,
): Command | null {
  if (!Number.isInteger(tile) || tile < 0 || tile >= TILE_TYPES.length) {
    throw new RangeError(`Invalid brush tile value: ${tile}`)
  }

  const lastCellPerKey = new Map<number, Cell>()
  for (const cell of cells) {
    if (!isInsideMap(model, cell.x, cell.y)) continue
    lastCellPerKey.set(cell.y * model.width + cell.x, cell)
  }
  if (lastCellPerKey.size === 0) return null

  const updates = [...lastCellPerKey.values()].map((cell) => ({
    x: cell.x,
    y: cell.y,
    tile,
  }))
  return { kind: 'setTiles', updates }
}
