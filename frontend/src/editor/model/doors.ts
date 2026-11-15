import { distance, isFinitePoint } from '@/shared/point'
import type { Point } from '@/shared/point'
import { newId } from '@/shared/id'

/**
 * Дверь — самостоятельная сущность (не привязана к стене): проём задаётся
 * отрезком `a`–`b` (створка всегда закрыта и лежит на нём). `imageId = null`
 * — отрисовка без текстуры (жирная заливка).
 */
export interface Door {
  readonly id: string
  readonly a: Point
  readonly b: Point
  readonly imageId: string | null
}

export function isValidDoor(door: Door): boolean {
  return (
    typeof door.id === 'string' &&
    door.id.length > 0 &&
    isFinitePoint(door.a) &&
    isFinitePoint(door.b) &&
    distance(door.a, door.b) > 0 &&
    (door.imageId === null || (typeof door.imageId === 'string' && door.imageId.length > 0))
  )
}

export function assertValidDoor(door: Door): void {
  if (typeof door.id !== 'string' || door.id.length === 0) {
    throw new RangeError('Door id must be a non-empty string')
  }
  if (!isFinitePoint(door.a) || !isFinitePoint(door.b)) {
    throw new RangeError('Door endpoints must be finite points')
  }
  if (distance(door.a, door.b) === 0) {
    throw new RangeError('Door endpoints must not coincide')
  }
  if (door.imageId !== null && (typeof door.imageId !== 'string' || door.imageId.length === 0)) {
    throw new RangeError('Door imageId must be null or a non-empty string')
  }
}

export function createDoor(
  a: Point,
  b: Point,
  options: { imageId?: string | null; id?: string } = {},
): Door {
  const door: Door = {
    id: options.id ?? newId(),
    a: { x: a.x, y: a.y },
    b: { x: b.x, y: b.y },
    imageId: options.imageId ?? null,
  }
  assertValidDoor(door)
  return door
}

export function findDoorById(doors: readonly Door[], id: string): Door | undefined {
  return doors.find((door) => door.id === id)
}

/** Длина проёма (створки) в клетках. */
export function doorLength(door: Door): number {
  return distance(door.a, door.b)
}
