import { distance, projectOnSegment } from '@/shared/point'
import { snapToHalfGrid } from '../model/snap'
import type { Point } from '@/shared/point'

/** Минимальная длина базы лестницы (клетки). */
export const MIN_STAIRS_BASE = 0.5
/** Минимальная глубина лестницы — расстояние от базы до дальнего края (клетки). */
export const MIN_STAIRS_DEPTH = 0.5

/**
 * Вершины лестницы по трём кликам: `start`–`base` — база (p0–p1), `end` — угол
 * дальнего края (p2). Четвёртая вершина — зеркало p2 относительно серединного
 * перпендикуляра к базе (для параллелограмма: `p3 = p0 + p2 − p1`). Все точки
 * привязаны к полуклеточной сетке.
 */
export function stairsVertices(start: Point, base: Point, end: Point): Point[] {
  const p0 = snapToHalfGrid(start)
  const p1 = snapToHalfGrid(base)
  const p2 = snapToHalfGrid(end)
  const p3 = { x: p0.x + p2.x - p1.x, y: p0.y + p2.y - p1.y }
  return [p0, p1, p2, p3]
}

/** Глубина лестницы: расстояние от p2 до прямой базы. */
function depth(p0: Point, p1: Point, p2: Point): number {
  return distance(p2, projectOnSegment(p2, p0, p1).point)
}

/** Форма лестницы пригодна: база и глубина не меньше минимума. */
export function isValidStairsShape(vertices: readonly Point[]): boolean {
  if (vertices.length !== 4) return false
  const [p0, p1, p2] = vertices
  return distance(p0, p1) >= MIN_STAIRS_BASE && depth(p0, p1, p2) >= MIN_STAIRS_DEPTH
}
