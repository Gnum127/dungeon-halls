import { distance } from '@/shared/point'
import { snapToHalfGrid } from '../model/snap'
import type { Point } from '@/shared/point'

/** Минимальная длина базы лестницы (клетки). */
export const MIN_STAIRS_BASE = 0.5
/** Минимальная глубина лестницы — расстояние от дальнего края до прямой базы (клетки). */
export const MIN_STAIRS_DEPTH = 0.5

/** Перпендикулярное расстояние от точки до прямой базы p0–p1. */
function lineDepth(p0: Point, p1: Point, p2: Point): number {
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return 0
  return Math.abs((p2.x - p0.x) * dy - (p2.y - p0.y) * dx) / length
}

/**
 * Вершины лестницы по трём кликам: `start`–`base` — база (p0–p1), `end` —
 * угол дальнего края (p2). Четвёртая вершина — зеркало p2 относительно
 * серединного перпендикуляра к базе: дальнее ребро p2–p3 параллельно базе и
 * отцентровано на нём. Все точки привязаны к полуклеточной сетке.
 */
export function stairsVertices(start: Point, base: Point, end: Point): Point[] {
  const p0 = snapToHalfGrid(start)
  const p1 = snapToHalfGrid(base)
  const p2 = snapToHalfGrid(end)

  const mx = (p0.x + p1.x) / 2
  const my = (p0.y + p1.y) / 2
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return [p0, p1, p2, { ...p2 }]

  // Отражение относительно линии через середину базы с нормалью-базой:
  // вдоль базового направления компонента меняет знак.
  const along = ((p2.x - mx) * dx + (p2.y - my) * dy) / lengthSq
  const p3 = {
    x: mx + (p2.x - mx) - 2 * along * dx,
    y: my + (p2.y - my) - 2 * along * dy,
  }
  return [p0, p1, p2, p3]
}

/** Форма лестницы пригодна: база и перпендикулярная глубина не меньше минимума. */
export function isValidStairsShape(vertices: readonly Point[]): boolean {
  if (vertices.length !== 4) return false
  const [p0, p1, p2] = vertices
  return distance(p0, p1) >= MIN_STAIRS_BASE && lineDepth(p0, p1, p2) >= MIN_STAIRS_DEPTH
}
