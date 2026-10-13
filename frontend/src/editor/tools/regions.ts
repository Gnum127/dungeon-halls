import type { Point } from '@/shared/point'

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
 * Возвращает пустой массив при нулевом радиусе или count < 3.
 */
export function regularPolygonPoints(
  center: Point,
  radial: Point,
  count: number,
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
  return points
}
