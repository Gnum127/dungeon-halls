import type { Point } from '@/shared/point'
import { distance, isFinitePoint, projectOnSegment } from '@/shared/point'
import { newId } from '@/shared/id'

/** С какой стороны от осевой линии строится тело стены (по нормали). */
export type WallExtends = 'left' | 'right' | 'both'

export const WALL_EXTENDS: readonly WallExtends[] = ['left', 'right', 'both']

export const DEFAULT_WALL_THICKNESS = 0.5

/**
 * Стена — векторная ломаная с телом. Заменяет клеточные рёбра старой модели:
 * осевая линия задаётся точками, тело утолщается на `thickness` клеток в
 * направлении `extends` (нормаль к каждому сегменту). Авто-стена — один
 * замкнутый контур (`points[0] === points[last]`), ручная — открытая ломаная.
 */
export interface WallSegment {
  readonly id: string
  readonly points: readonly Point[]
  readonly extends: WallExtends
  readonly thickness: number
}

export function isWallExtends(value: unknown): value is WallExtends {
  return typeof value === 'string' && (WALL_EXTENDS as readonly string[]).includes(value)
}

export function isValidWallSegment(segment: WallSegment): boolean {
  return (
    typeof segment.id === 'string' &&
    segment.id.length > 0 &&
    Array.isArray(segment.points) &&
    segment.points.length >= 2 &&
    segment.points.every(isFinitePoint) &&
    isWallExtends(segment.extends) &&
    typeof segment.thickness === 'number' &&
    Number.isFinite(segment.thickness) &&
    segment.thickness >= 0
  )
}

export function assertValidWallSegment(segment: WallSegment): void {
  if (typeof segment.id !== 'string' || segment.id.length === 0) {
    throw new RangeError('Wall segment id must be a non-empty string')
  }
  if (!Array.isArray(segment.points) || segment.points.length < 2) {
    throw new RangeError(
      `Wall segment must have at least 2 points, got ${segment.points?.length ?? 0}`,
    )
  }
  if (!segment.points.every(isFinitePoint)) {
    throw new RangeError('Wall segment points must be finite points')
  }
  if (!isWallExtends(segment.extends)) {
    throw new RangeError(`Unknown wall extends: ${String(segment.extends)}`)
  }
  if (
    typeof segment.thickness !== 'number' ||
    !Number.isFinite(segment.thickness) ||
    segment.thickness < 0
  ) {
    throw new RangeError(`Wall thickness must be a number >= 0, got ${String(segment.thickness)}`)
  }
}

export function createWallSegment(
  points: readonly Point[],
  options: { extends?: WallExtends; thickness?: number; id?: string } = {},
): WallSegment {
  const segment: WallSegment = {
    id: options.id ?? newId(),
    points: points.map((p) => ({ x: p.x, y: p.y })),
    extends: options.extends ?? 'right',
    thickness: options.thickness ?? DEFAULT_WALL_THICKNESS,
  }
  assertValidWallSegment(segment)
  return segment
}

export interface NearestWallHit {
  readonly segment: WallSegment
  readonly distance: number
  readonly point: Point
  readonly t: number
  /** Индекс сегмента ломаной, на который спроецировалась точка. */
  readonly index: number
}

/** Ближайший стеновой сегмент к точке (по расстоянию до осевой линии). */
export function nearestWallSegment(
  segments: readonly WallSegment[],
  point: Point,
): NearestWallHit | undefined {
  let best: NearestWallHit | undefined
  for (const segment of segments) {
    for (let i = 0; i + 1 < segment.points.length; i += 1) {
      const a = segment.points[i]
      const b = segment.points[i + 1]
      const projected = projectOnSegment(point, a, b)
      const dist = distance(point, projected.point)
      if (!best || dist < best.distance) {
        best = { segment, distance: dist, point: projected.point, t: projected.t, index: i }
      }
    }
  }
  return best
}
