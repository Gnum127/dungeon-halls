import { polygonSelfIntersects } from '../model/regions'
import type { Point } from '@/shared/point'

/** Границы карты в клетках (для обрезки вершин полигона). */
export interface GridBounds {
  readonly cols: number
  readonly rows: number
}

/**
 * Обрезает каждую вершину полигона по границам карты `[0, cols] × [0, rows]`
 * (клеточные координаты). Углы фиксированы: при выходе за край полигон может
 * стать нерегулярным — это осознанное поведение. Соседние вершины, слипшиеся
 * в одну точку после клампа, схлопываются (иначе вырожденные рёбра ломают
 * boolean-операции авто-стен).
 */
export function clampPolygonToGrid(
  polygon: readonly Point[],
  cols: number,
  rows: number,
): Point[] {
  const clamped = polygon.map((point) => ({
    x: Math.min(Math.max(point.x, 0), cols),
    y: Math.min(Math.max(point.y, 0), rows),
  }))
  const result: Point[] = []
  for (const point of clamped) {
    const last = result[result.length - 1]
    if (!last || last.x !== point.x || last.y !== point.y) result.push(point)
  }
  const first = result[0]
  const last = result[result.length - 1]
  if (result.length > 1 && first.x === last.x && first.y === last.y) result.pop()
  return result
}

/** Площадь полигона по формуле шнуровки (по модулю). */
export function polygonArea(polygon: readonly Point[]): number {
  let doubleArea = 0
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    doubleArea += a.x * b.y - b.x * a.y
  }
  return Math.abs(doubleArea) / 2
}

/** Полигон не вырожден: ≥3 вершин и заметная площадь (не схлопнулся). */
export function hasPolygonArea(polygon: readonly Point[]): boolean {
  return polygon.length >= 3 && polygonArea(polygon) > 1e-9
}

/** Полигон пригоден для коммита: не вырожден и без самопересечений. */
export function isCommittablePolygon(polygon: readonly Point[]): boolean {
  return hasPolygonArea(polygon) && !polygonSelfIntersects(polygon)
}

/**
 * Прямоугольный полигон по двум угловым клеткам (включительно), обрезанный по
 * границам карты. Возвращает 4 вершины в клеточных координатах.
 */
export function rectPolygon(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cols: number,
  rows: number,
): Point[] {
  const minX = Math.max(0, Math.min(ax, bx))
  const maxX = Math.min(cols, Math.max(ax, bx) + 1)
  const minY = Math.max(0, Math.min(ay, by))
  const maxY = Math.min(rows, Math.max(ay, by) + 1)
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
}

/** Прямоугольник непустой (есть площадь ≥ 1 клетки). */
export function hasRectArea(polygon: readonly Point[]): boolean {
  return polygon.length === 4 && polygon[2].x > polygon[0].x && polygon[2].y > polygon[0].y
}

/**
 * Полигон пригоден для превью/заливки: ≥3 вершин (форма не важна —
 * прямоугольник или правильный N-угольник). Регрессия: гейт по `hasRectArea`
 * молча не рисовал превью многогранника.
 */
export function isDrawablePolygon(polygon: readonly Point[]): boolean {
  return polygon.length >= 3
}

/**
 * Вершины правильного N-угольника: направление первой вершины — от центра к
 * радиальной точке (задаёт поворот), остальные равномерно по окружности.
 * Возвращает пустой массив при нулевом радиусе или count < 3. Если заданы
 * границы `bounds`, каждая вершина обрезается по границам карты.
 */
export function regularPolygonPoints(
  center: Point,
  radial: Point,
  count: number,
  bounds?: GridBounds,
): Point[] {
  const dx = radial.x - center.x
  const dy = radial.y - center.y
  const radius = Math.hypot(dx, dy)
  if (radius === 0 || count < 3) return []
  const offset = Math.atan2(dy, dx)
  const points: Point[] = []
  for (let k = 0; k < count; k += 1) {
    const angle = offset + (k * 2 * Math.PI) / count
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    })
  }
  return bounds ? clampPolygonToGrid(points, bounds.cols, bounds.rows) : points
}
