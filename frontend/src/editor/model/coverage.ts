import { pointInPolygon } from '@/shared/point'
import type { Point } from '@/shared/point'
import type { MapModel } from './types'

/**
 * Тестер покрытия точки «верхний побеждает»: регионы применяются в порядке
 * zOrder (возрастание), `empty` снимает покрытие; лестницы-оверлеи добавляют
 * покрытие поверх. Сортировка выполняется один раз при создании тестера.
 */
export function createCoverageTester(model: MapModel): (point: Point) => boolean {
  const sortedRegions = [...model.regions].sort((a, b) => a.zOrder - b.zOrder)
  const stairs = model.stairs
  return (point: Point) => {
    let covered = false
    for (const region of sortedRegions) {
      if (pointInPolygon(point, region.polygon)) {
        covered = region.tileType !== 'empty'
      }
    }
    if (covered) return true
    for (const entry of stairs) {
      if (pointInPolygon(point, entry.polygon)) return true
    }
    return false
  }
}

/** Диапазон клеток (включительно) для перечисления точек сетки. */
export interface CellRange {
  readonly firstCol: number
  readonly lastCol: number
  readonly firstRow: number
  readonly lastRow: number
}

const CELL_CORNERS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
]

/**
 * Точки точечной сетки в заданном диапазоне клеток: углы каждой покрытой
 * клетки, без дубликатов общих углов. Единый источник для canvas и SVG/PDF.
 * Порядок детерминирован (обход по строкам и столбцам).
 */
export function coverageGridPoints(model: MapModel, range: CellRange): Point[] {
  const covered = createCoverageTester(model)
  const points: Point[] = []
  const seen = new Set<string>()
  for (let row = range.firstRow; row <= range.lastRow; row += 1) {
    for (let col = range.firstCol; col <= range.lastCol; col += 1) {
      if (!covered({ x: col + 0.5, y: row + 0.5 })) continue
      for (const [dc, dr] of CELL_CORNERS) {
        const x = col + dc
        const y = row + dr
        const key = `${x},${y}`
        if (seen.has(key)) continue
        seen.add(key)
        points.push({ x, y })
      }
    }
  }
  return points
}

/**
 * Все углы клеток диапазона (включая свободные), без дубликатов. Диапазон
 * задаёт клетки, поэтому углы шире на единицу с каждой стороны. Порядок
 * детерминирован (обход по строкам и столбцам).
 */
export function allGridPoints(range: CellRange): Point[] {
  const points: Point[] = []
  for (let row = range.firstRow; row <= range.lastRow + 1; row += 1) {
    for (let col = range.firstCol; col <= range.lastCol + 1; col += 1) {
      points.push({ x: col, y: row })
    }
  }
  return points
}

/** Углы клеток диапазона, разделённые по покрытию. */
export interface GridPointSets {
  /** Углы покрытых клеток (яркая сетка). */
  readonly covered: Point[]
  /** Остальные углы диапазона (тусклая сетка свободного поля). */
  readonly empty: Point[]
}

/**
 * Углы сетки диапазона, разделённые на покрытые и свободные. Покрытие
 * считается один раз — единый источник для canvas и SVG/PDF. Порядок внутри
 * каждой группы детерминирован (обход по строкам и столбцам). Диапазон задаёт
 * клетки, поэтому углы шире на единицу с каждой стороны.
 */
export function gridPoints(model: MapModel, range: CellRange): GridPointSets {
  const covered = coverageGridPoints(model, range)
  const coveredKeys = new Set(covered.map((p) => `${p.x},${p.y}`))
  const empty = allGridPoints(range).filter((p) => !coveredKeys.has(`${p.x},${p.y}`))
  return { covered, empty }
}
