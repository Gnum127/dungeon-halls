import { distance } from '@/shared/point'
import { nearestWallSegment, pointAlongWallSegment } from '../model/wallSegments'
import type { WallSegment } from '../model/wallSegments'
import type { Door } from '../model/doors'
import type { Point } from '@/shared/point'

/**
 * Хит-тест двери в мировых координатах: возвращает id ближайшей двери в
 * пределах `hitRadius`, иначе null. Дверь ищется только на ближайшем стеновом
 * сегменте; расстояние — от точки до центра двери (положение на ломаной).
 * Чистая функция: без DOM/Canvas, пригодна для тестов.
 */
export function doorHitTest(
  worldPoint: Point,
  doors: readonly Door[],
  walls: readonly WallSegment[],
  hitRadius: number,
): string | null {
  const hit = nearestWallSegment(walls, worldPoint)
  if (!hit) return null

  let bestId: string | null = null
  let bestDistance = Infinity
  for (const door of doors) {
    if (door.wallSegmentId !== hit.segment.id) continue
    const center = pointAlongWallSegment(hit.segment, door.position)
    const doorDistance = distance(worldPoint, center)
    if (doorDistance <= hitRadius && doorDistance < bestDistance) {
      bestDistance = doorDistance
      bestId = door.id
    }
  }
  return bestId
}
