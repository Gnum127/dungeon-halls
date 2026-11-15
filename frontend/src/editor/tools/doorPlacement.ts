import { snapToCellCharacteristics } from '../model/snap'
import type { MapModel } from '../model/types'
import type { Point } from '@/shared/point'

/**
 * Концы двери по двум кликам: обе точки привязываются к характеристическим
 * точкам своих клеток (9 узлов 0.5×0.5 при покрытии, 4 угла без). Дверь НЕ
 * магнитится к стене — разрыв стены делает `wallRuns` по факту пересечения.
 * Чистая функция для тестов.
 */
export function doorEndpoints(
  model: MapModel,
  startWorld: Point,
  endWorld: Point,
): { a: Point; b: Point } {
  return {
    a: snapToCellCharacteristics(model, startWorld),
    b: snapToCellCharacteristics(model, endWorld),
  }
}
