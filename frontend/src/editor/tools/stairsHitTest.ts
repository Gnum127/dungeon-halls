import { pointInPolygon } from '@/shared/point'
import type { StairsPolygon } from '../model/stairs'
import type { Point } from '@/shared/point'

/**
 * Хит-тест лестницы в мировых координатах: id верхней (добавленной последней)
 * лестницы, чей контур содержит точку; иначе null. Чистая функция.
 */
export function stairsHitTest(point: Point, stairs: readonly StairsPolygon[]): string | null {
  for (let i = stairs.length - 1; i >= 0; i -= 1) {
    if (pointInPolygon(point, stairs[i].polygon)) return stairs[i].id
  }
  return null
}
