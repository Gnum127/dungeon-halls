import type { MapModel } from '../model/types'

/** Клетка лежит внутри сетки карты (целые неотрицательные координаты). */
export function isInsideMap(model: MapModel, x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < model.grid.width &&
    y < model.grid.height
  )
}
