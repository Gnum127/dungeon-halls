import { distance } from '@/shared/point'
import { snapToCellCharacteristics, SNAP_STEP } from '../model/snap'
import { nearestWallSegment } from '../model/wallSegments'
import type { MapModel } from '../model/types'
import type { NearestWallHit } from '../model/wallSegments'
import type { Point } from '@/shared/point'

/** Максимальное расстояние до осевой стены (в клетках) для выравнивания двери. */
export const DOOR_WALL_DISTANCE = 0.5
/** Минимальная длина проёма двери (клетки) — один полуклеточный шаг. */
export const MIN_DOOR_LENGTH = SNAP_STEP

/**
 * Привязка к стене: якорь кладётся на осевую линию (снап вдоль неё к 0.5),
 * второй конец откладывается вдоль стены на длину, кратную 0.5. Возвращает
 * `null`, если сегмент вырожден.
 */
function alignToWall(
  hit: NearestWallHit,
  startWorld: Point,
  endWorld: Point,
): {
  a: Point
  b: Point
} | null {
  const points = hit.segment.points
  const from = points[hit.index]
  const to = points[hit.index + 1]
  const length = distance(from, to)
  if (length === 0) return null

  const tx = (to.x - from.x) / length
  const ty = (to.y - from.y) / length
  const raw = (startWorld.x - from.x) * tx + (startWorld.y - from.y) * ty
  const snapped = Math.max(0, Math.min(length, Math.round(raw / SNAP_STEP) * SNAP_STEP))
  const a = { x: from.x + tx * snapped, y: from.y + ty * snapped }

  const along = (endWorld.x - a.x) * tx + (endWorld.y - a.y) * ty
  const steps = Math.max(MIN_DOOR_LENGTH / SNAP_STEP, Math.round(Math.abs(along) / SNAP_STEP))
  const sign = along < 0 ? -1 : 1
  const span = steps * SNAP_STEP * sign
  return { a, b: { x: a.x + tx * span, y: a.y + ty * span } }
}

/**
 * Концы двери по двум кликам. Если якорь лежит на стене (ближе
 * `DOOR_WALL_DISTANCE`) — проём идёт ВДОЛЬ стены и лежит на её осевой линии;
 * иначе оба конца привязываются к характеристическим точкам своих клеток
 * (9 узлов 0.5×0.5 при покрытии, 4 угла без). Чистая функция для тестов.
 */
export function doorEndpoints(
  model: MapModel,
  startWorld: Point,
  endWorld: Point,
): { a: Point; b: Point } {
  const wallHit = nearestWallSegment(model.walls, startWorld)
  if (wallHit && wallHit.distance <= DOOR_WALL_DISTANCE) {
    const aligned = alignToWall(wallHit, startWorld, endWorld)
    if (aligned) return aligned
  }

  return {
    a: snapToCellCharacteristics(model, startWorld),
    b: snapToCellCharacteristics(model, endWorld),
  }
}
