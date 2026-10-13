import type { TileTypeName } from '@/shared/tiles'
import { TILE_TYPES } from '@/shared/tiles'
import type { Point } from '@/shared/point'
import { isFinitePoint } from '@/shared/point'
import { newId } from '@/shared/id'

/**
 * Регион покрытия — векторный полигон с типом ландшафта. Заменяет клеточные
 * тайлы: помещения строятся фигурами, а не раскраской клеток.
 * Вершины — в клеточных координатах (float), замыкание полигона не хранится:
 * последняя вершина не дублирует первую, рёбра замыкаются при рендере.
 */
export interface TerrainRegion {
  readonly id: string
  readonly tileType: TileTypeName
  readonly polygon: readonly Point[]
  readonly zOrder: number
}

const EPSILON = 1e-9

export function isTileTypeName(value: unknown): value is TileTypeName {
  return typeof value === 'string' && (TILE_TYPES as readonly string[]).includes(value)
}

function orientation(p: Point, q: Point, r: Point): number {
  const value = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y)
  if (Math.abs(value) < EPSILON) return 0
  return value > 0 ? 1 : 2
}

function onSegment(p: Point, q: Point, r: Point): boolean {
  return (
    Math.min(p.x, r.x) - EPSILON <= q.x &&
    q.x <= Math.max(p.x, r.x) + EPSILON &&
    Math.min(p.y, r.y) - EPSILON <= q.y &&
    q.y <= Math.max(p.y, r.y) + EPSILON
  )
}

/** Пересекаются ли отрезки [p1,p2] и [p3,p4] (включая касания/коллинеарность). */
export function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const o1 = orientation(p1, p2, p3)
  const o2 = orientation(p1, p2, p4)
  const o3 = orientation(p3, p4, p1)
  const o4 = orientation(p3, p4, p2)

  if (o1 !== o2 && o3 !== o4) return true

  if (o1 === 0 && onSegment(p1, p3, p2)) return true
  if (o2 === 0 && onSegment(p1, p4, p2)) return true
  if (o3 === 0 && onSegment(p3, p1, p4)) return true
  if (o4 === 0 && onSegment(p3, p2, p4)) return true

  return false
}

/**
 * Самопересечение полигона. Соседние рёбра (общий конец) не считаются
 * пересечением; первое и последнее ребро тоже соседние (контур замкнут).
 */
export function polygonSelfIntersects(points: readonly Point[]): boolean {
  const n = points.length
  if (n < 4) return false
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const adjacent = j === i + 1 || (i === 0 && j === n - 1)
      if (adjacent) continue
      const a1 = points[i]
      const a2 = points[(i + 1) % n]
      const b1 = points[j]
      const b2 = points[(j + 1) % n]
      if (segmentsIntersect(a1, a2, b1, b2)) return true
    }
  }
  return false
}

/** Полигон валиден как регион: ≥3 конечных точек, без самопересечений. */
export function isValidPolygon(polygon: unknown): polygon is readonly Point[] {
  if (!Array.isArray(polygon) || polygon.length < 3) return false
  if (!polygon.every(isFinitePoint)) return false
  return !polygonSelfIntersects(polygon)
}

export function isValidRegion(region: TerrainRegion): boolean {
  return (
    typeof region.id === 'string' &&
    region.id.length > 0 &&
    isTileTypeName(region.tileType) &&
    Number.isInteger(region.zOrder) &&
    region.zOrder >= 0 &&
    isValidPolygon(region.polygon)
  )
}

export function assertValidRegion(region: TerrainRegion): void {
  if (typeof region.id !== 'string' || region.id.length === 0) {
    throw new RangeError('Region id must be a non-empty string')
  }
  if (!isTileTypeName(region.tileType)) {
    throw new RangeError(`Unknown region tileType: ${String(region.tileType)}`)
  }
  if (!Number.isInteger(region.zOrder) || region.zOrder < 0) {
    throw new RangeError(
      `Region zOrder must be a non-negative integer, got ${String(region.zOrder)}`,
    )
  }
  const vertexCount = Array.isArray(region.polygon) ? region.polygon.length : 0
  if (vertexCount < 3) {
    throw new RangeError(`Region polygon must have at least 3 vertices, got ${vertexCount}`)
  }
  if (!region.polygon.every(isFinitePoint)) {
    throw new RangeError('Region polygon vertices must be finite points')
  }
  if (polygonSelfIntersects(region.polygon)) {
    throw new RangeError('Region polygon must not self-intersect')
  }
}

/** Фабрика региона; id можно переопределить (тесты/детерминизм). */
export function createTerrainRegion(
  tileType: TileTypeName,
  polygon: readonly Point[],
  zOrder: number,
  id: string = newId(),
): TerrainRegion {
  const region: TerrainRegion = {
    id,
    tileType,
    polygon: polygon.map((p) => ({ x: p.x, y: p.y })),
    zOrder,
  }
  assertValidRegion(region)
  return region
}

/** Следующий z-order: последний построенный регион рисуется поверх всех. */
export function nextZOrder(regions: readonly TerrainRegion[]): number {
  return regions.reduce((max, region) => Math.max(max, region.zOrder), -1) + 1
}

export interface RegionBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

/** Ограничивающий прямоугольник полигона (для culling). */
export function regionBounds(region: TerrainRegion): RegionBounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const { x, y } of region.polygon) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}
