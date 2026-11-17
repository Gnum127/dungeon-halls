import { objectFootprint } from './objects'
import type { MapObject, ObjectScale } from './types'
import type { Point } from '@/shared/point'

/**
 * Выделенная сущность (этап 28): объект, дверь, лестница или ничего.
 * Заменяет одиночные `selectedObjectId`/`stairsSelectedId`.
 */
export type SelectedEntity =
  | { readonly type: 'object'; readonly id: number }
  | { readonly type: 'door'; readonly id: string }
  | { readonly type: 'stairs'; readonly id: string }
  | null

/** Угол footprint'а, потянув за который меняют размер объекта. */
export type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw'

const HANDLE_ORDER: readonly ResizeHandle[] = ['nw', 'ne', 'se', 'sw']

/** Радиус попадания по хендлу в экранных пикселях (не меньше 7px при мелком зуме). */
const HANDLE_HIT_PX = 7

/**
 * Верхняя граница хит-зоны в долях меньшей стороны footprint'а: центр мелкого
 * объекта (1×1) должен оставаться «перемещением», а не растягиванием.
 */
const HANDLE_MAX_FOOTPRINT_FRACTION = 0.4

/** Мировой прямоугольник footprint (клетки): x/y/width/height. */
export function footprintRect(object: MapObject): { x: number; y: number; w: number; h: number } {
  return objectFootprint(object)
}

/** Координаты четырёх угловых хендлов footprint'а (мировые клетки). */
export function resizeHandlePoints(object: MapObject): Record<ResizeHandle, Point> {
  const { x, y, w, h } = footprintRect(object)
  return {
    nw: { x, y },
    ne: { x: x + w, y },
    se: { x: x + w, y: y + h },
    sw: { x, y: y + h },
  }
}

/**
 * Хендл под мировой точкой (или null). Радиус задаётся в экранных px, но не
 * превышает долю меньшей стороны footprint'а, иначе у мелких объектов хит-зона
 * накрыла бы весь объект и перетаскивание превращалось бы в ресайз.
 */
export function resizeHandleAt(
  object: MapObject,
  world: Point,
  cellSize: number,
): ResizeHandle | null {
  const { w, h } = footprintRect(object)
  const pixelReach = Math.max(HANDLE_HIT_PX, cellSize * 0.25) / cellSize
  const reach = Math.min(pixelReach, Math.min(w, h) * HANDLE_MAX_FOOTPRINT_FRACTION)
  const points = resizeHandlePoints(object)
  for (const handle of HANDLE_ORDER) {
    const point = points[handle]
    if (Math.abs(world.x - point.x) <= reach && Math.abs(world.y - point.y) <= reach) {
      return handle
    }
  }
  return null
}

/** Новый footprint объекта: origin + размер (клетки). */
export interface ObjectBounds {
  readonly x: number
  readonly y: number
  readonly scale: ObjectScale
}

/** Границы сетки для клампа ресайза (origin не должен выйти за поле). */
export interface ResizeGridBounds {
  readonly width: number
  readonly height: number
}

/**
 * Новый footprint при перетаскивании угла: якорь — ПРОТИВОПОЛОЖНЫЙ угол
 * (тянешь `se` — растёт вправо-вниз, тянешь `nw` — влево-вверх). Границы
 * округляются до целых клеток (origin может быть float — ресайз снапит к
 * сетке), размер всегда целый ≥ 1; origin не уходит в минус и не выходит за
 * поле `bounds` (если задано), а после клампа минимум 1×1 сохраняется движением
 * дальней грани.
 */
export function resizedFootprint(
  object: MapObject,
  handle: ResizeHandle,
  world: Point,
  bounds?: ResizeGridBounds,
): ObjectBounds {
  const { x, y, w, h } = footprintRect(object)
  // Целые клеточные границы текущего footprint'а.
  const left0 = Math.round(x)
  const top0 = Math.round(y)
  const right0 = Math.round(x + w)
  const bottom0 = Math.round(y + h)

  const anchorX = handle === 'nw' || handle === 'sw' ? right0 : left0
  const anchorY = handle === 'nw' || handle === 'ne' ? bottom0 : top0

  const movingX = clampToGrid(Math.round(world.x), bounds?.width)
  const movingY = clampToGrid(Math.round(world.y), bounds?.height)
  let left = Math.min(anchorX, movingX)
  let right = Math.max(anchorX, movingX)
  let top = Math.min(anchorY, movingY)
  let bottom = Math.max(anchorY, movingY)

  // Минимальный размер 1×1: сдвигаем подвижную грань от якоря.
  if (right - left < 1) {
    if (movingX >= anchorX) right = left + 1
    else left = right - 1
  }
  if (bottom - top < 1) {
    if (movingY >= anchorY) bottom = top + 1
    else top = bottom - 1
  }

  // Origin не уходит в минус; размер восстанавливаем до 1×1 после клампа.
  left = Math.max(0, left)
  top = Math.max(0, top)
  right = Math.max(right, left + 1)
  bottom = Math.max(bottom, top + 1)

  return { x: left, y: top, scale: { w: right - left, h: bottom - top } }
}

/** Целое значение координаты в диапазоне [0, size-1] (если задан размер). */
function clampToGrid(value: number, size: number | undefined): number {
  if (size === undefined) return value
  return Math.min(Math.max(value, 0), Math.max(0, size - 1))
}
