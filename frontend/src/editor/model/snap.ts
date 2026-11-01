import { createCoverageTester } from './coverage'
import type { MapModel } from './types'
import type { Point } from '@/shared/point'

/** Шаг характеристической сетки внутри клетки (полклетки). */
export const SNAP_STEP = 0.5

/** Округление точки к полуклеточной сетке (любая точка, без учёта покрытия). */
export function snapToHalfGrid(point: Point): Point {
  return {
    x: Math.round(point.x / SNAP_STEP) * SNAP_STEP,
    y: Math.round(point.y / SNAP_STEP) * SNAP_STEP,
  }
}

/**
 * Характеристические точки клетки для привязки: при покрытии — узлы 0.5×0.5
 * (3×3 = 9 точек), без покрытия — только углы клетки (4 точки). Координаты —
 * мировые (клетки, float). Единый источник для превью и инструментов.
 */
export function characteristicPoints(cell: Point, covered: boolean): Point[] {
  const offsets = covered ? [0, SNAP_STEP, 1] : [0, 1]
  const points: Point[] = []
  for (const dy of offsets) {
    for (const dx of offsets) {
      points.push({ x: cell.x + dx, y: cell.y + dy })
    }
  }
  return points
}

/** Ближайшая к `target` точка из списка (по квадрату расстояния); `null` — пусто. */
export function nearestSnapPoint(points: readonly Point[], target: Point): Point | null {
  let best: Point | null = null
  let bestDistanceSq = Infinity
  for (const point of points) {
    const dx = point.x - target.x
    const dy = point.y - target.y
    const distanceSq = dx * dx + dy * dy
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq
      best = point
    }
  }
  return best
}

/**
 * Привязка мировой точки к характеристическим точкам её клетки: при покрытии —
 * ближайший узел 0.5×0.5 (9), без покрытия — ближайший угол клетки (4). Единый
 * снап для стен/дверей/лестниц.
 */
export function snapToCellCharacteristics(model: MapModel, point: Point): Point {
  const cell = { x: Math.floor(point.x), y: Math.floor(point.y) }
  const covered = createCoverageTester(model)({ x: cell.x + 0.5, y: cell.y + 0.5 })
  return nearestSnapPoint(characteristicPoints(cell, covered), point) ?? point
}
