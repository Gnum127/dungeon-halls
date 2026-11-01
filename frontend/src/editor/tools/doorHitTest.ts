import { pointToSegmentDistance } from '@/shared/point'
import type { Door } from '../model/doors'
import type { Point } from '@/shared/point'

/**
 * Хит-тест двери в мировых координатах: возвращает id ближайшей двери, если
 * расстояние от точки до отрезка проёма (`a`–`b`) не превышает `hitRadius`,
 * иначе null. Дверь самостоятельна (не привязана к стене) — чистая функция.
 */
export function doorHitTest(
  worldPoint: Point,
  doors: readonly Door[],
  hitRadius: number,
): string | null {
  let bestId: string | null = null
  let bestDistance = Infinity
  for (const door of doors) {
    const doorDistance = pointToSegmentDistance(worldPoint, door.a, door.b)
    if (doorDistance <= hitRadius && doorDistance < bestDistance) {
      bestDistance = doorDistance
      bestId = door.id
    }
  }
  return bestId
}
