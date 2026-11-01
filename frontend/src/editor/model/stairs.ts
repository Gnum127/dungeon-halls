import type { Point } from '@/shared/point'
import { isValidPolygon } from './regions'
import { newId } from '@/shared/id'

/**
 * Лестница — отдельная сущность модели (не покрытие и не стена): контур с
 * поперечными ступенями, без заливки и без авто-стен. Вершины — в клеточных
 * координатах (float). Участвует в точечной сетке и снапе (этапы 16/18).
 */
export interface StairsPolygon {
  readonly id: string
  readonly polygon: readonly Point[]
}

export function isValidStairsPolygon(value: StairsPolygon): boolean {
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    Array.isArray(value.polygon) &&
    isValidPolygon(value.polygon)
  )
}

export function assertValidStairsPolygon(value: StairsPolygon): void {
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new RangeError('Stairs id must be a non-empty string')
  }
  const vertexCount = Array.isArray(value.polygon) ? value.polygon.length : 0
  if (vertexCount < 3) {
    throw new RangeError(`Stairs polygon must have at least 3 vertices, got ${vertexCount}`)
  }
  if (!isValidPolygon(value.polygon)) {
    throw new RangeError('Stairs polygon is invalid (finite, no self-intersection)')
  }
}

export function createStairsPolygon(polygon: readonly Point[], id: string = newId()): StairsPolygon {
  const stairs: StairsPolygon = { id, polygon: polygon.map((p) => ({ x: p.x, y: p.y })) }
  assertValidStairsPolygon(stairs)
  return stairs
}
