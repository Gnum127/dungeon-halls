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

/**
 * Мировая float-точка лежит в пределах карты включительно (`[0, cols] × [0, rows]`):
 * для инструментов фигур, которые строятся от точки до точки и клампятся по краю.
 */
export function isWorldPointInsideMap(model: MapModel, x: number, y: number): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 0 &&
    y >= 0 &&
    x <= model.grid.width &&
    y <= model.grid.height
  )
}
