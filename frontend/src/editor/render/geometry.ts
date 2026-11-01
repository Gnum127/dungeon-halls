import type { Viewport } from './viewport'
import type { WallSegment } from '../model/wallSegments'
import type { Point } from '@/shared/point'

/** Целочисленная клетка сетки (offset-координаты). */
export interface Cell {
  readonly x: number
  readonly y: number
}

/** Центр клетки в мировых пикселях (квадратная сетка). */
export function cellCenterAt(col: number, row: number, cellSize: number): { x: number; y: number } {
  return { x: (col + 0.5) * cellSize, y: (row + 0.5) * cellSize }
}

export interface CellRange {
  readonly firstCol: number
  readonly lastCol: number
  readonly firstRow: number
  readonly lastRow: number
}

/** Диапазон видимых клеток (квадратная сетка), обрезанный по карте. */
export function visibleCellRange(viewport: Viewport, cols: number, rows: number): CellRange {
  const { width, height, cellSize, offsetX, offsetY } = viewport
  return {
    firstCol: Math.max(0, Math.floor(offsetX / cellSize)),
    firstRow: Math.max(0, Math.floor(offsetY / cellSize)),
    lastCol: Math.min(cols - 1, Math.floor((offsetX + width) / cellSize)),
    lastRow: Math.min(rows - 1, Math.floor((offsetY + height) / cellSize)),
  }
}

export interface MapPixelBounds {
  readonly width: number
  readonly height: number
  readonly originX: number
  readonly originY: number
}

/** Габариты карты в пикселях (квадратная сетка: origin всегда 0). */
export function mapPixelBounds(cols: number, rows: number, cellSize: number): MapPixelBounds {
  return { width: cols * cellSize, height: rows * cellSize, originX: 0, originY: 0 }
}

/**
 * Осевая линия стены для рисования: точки без дублирующей замыкающей (для
 * замкнутого контура) и признак замкнутости. Замкнутость — совпадение координат
 * первого и последнего узла (`points[0]` и `points[last]`). Единый источник
 * геометрии стен для canvas, SVG/PDF и живого превью.
 */
export function wallPath(wall: WallSegment): { points: readonly Point[]; closed: boolean } {
  const points = wall.points
  const closed =
    points.length > 2 &&
    points[0].x === points[points.length - 1].x &&
    points[0].y === points[points.length - 1].y
  return { points: closed ? points.slice(0, -1) : points, closed }
}

export interface Bounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export function polygonBounds(polygon: readonly Point[]): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const { x, y } of polygon) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

export interface Segment {
  readonly a: Point
  readonly b: Point
}

/** Шаг линий-ступеней лестницы (в клетках). */
export const STAIRS_STEP_SPACING = 0.25

/**
 * Линии-ступени лестницы в мировых координатах (клетки). Ось — от середины
 * базы (p0–p1) к середине дальнего края (p2–p3), ступени перпендикулярны оси;
 * для полигонов ≠4 вершин — горизонтальный фолбэк по bounding box.
 */
export function stairsStepSegments(polygon: readonly Point[]): Segment[] {
  if (polygon.length < 3) return []
  const bounds = polygonBounds(polygon)
  const extent = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)

  if (polygon.length !== 4) {
    const segments: Segment[] = []
    for (let y = bounds.minY; y <= bounds.maxY; y += STAIRS_STEP_SPACING) {
      segments.push({ a: { x: bounds.minX, y }, b: { x: bounds.maxX, y } })
    }
    return segments
  }

  const base = { x: (polygon[0].x + polygon[1].x) / 2, y: (polygon[0].y + polygon[1].y) / 2 }
  const far = { x: (polygon[2].x + polygon[3].x) / 2, y: (polygon[2].y + polygon[3].y) / 2 }
  const axisLength = Math.hypot(far.x - base.x, far.y - base.y)
  const dirX = axisLength === 0 ? 1 : (far.x - base.x) / axisLength
  const dirY = axisLength === 0 ? 0 : (far.y - base.y) / axisLength
  const normalX = -dirY
  const normalY = dirX
  const span = extent + axisLength
  const segments: Segment[] = []
  for (let distance = 0; distance <= axisLength; distance += STAIRS_STEP_SPACING) {
    const px = base.x + dirX * distance
    const py = base.y + dirY * distance
    segments.push({
      a: { x: px - normalX * span, y: py - normalY * span },
      b: { x: px + normalX * span, y: py + normalY * span },
    })
  }
  return segments
}
