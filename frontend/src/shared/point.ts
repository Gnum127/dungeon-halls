/** Общая точка в мировых координатах (в клетках, float). */
export interface Point {
  readonly x: number
  readonly y: number
}

const EPSILON = 1e-9

export function pointsEqual(a: Point, b: Point, epsilon: number = EPSILON): boolean {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon
}

/** Структурная проверка: объект с конечными числовыми x и y. */
export function isFinitePoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null) return false
  const { x, y } = value as Record<string, unknown>
  return typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)
}

/** Линейная интерполяция между точками; t = 0 → a, t = 1 → b. */
export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Проекция точки на отрезок [a, b] с зажимом параметра в [0, 1]. */
export function projectOnSegment(p: Point, a: Point, b: Point): { point: Point; t: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) {
    return { point: { x: a.x, y: a.y }, t: 0 }
  }
  const raw = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq
  const t = Math.max(0, Math.min(1, raw))
  return { point: { x: a.x + t * dx, y: a.y + t * dy }, t }
}

export function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  return distance(p, projectOnSegment(p, a, b).point)
}

/** Знаковая площадь полигона (положительная — против часовой). */
export function signedPolygonArea(points: readonly Point[]): number {
  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }
  return area / 2
}

/**
 * Точка внутри полигона. Граница (ребро/вершина) считается частью полигона —
 * это даёт устойчивый результат при hit-test по краям, где чистый ray casting
 * недетерминирован.
 */
export function pointInPolygon(p: Point, polygon: readonly Point[]): boolean {
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    if (pointToSegmentDistance(p, polygon[j], polygon[i]) <= EPSILON) return true
  }
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    const intersects =
      a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    if (intersects) inside = !inside
  }
  return inside
}
