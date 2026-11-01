import { distance, isFinitePoint } from '@/shared/point'
import type { Point } from '@/shared/point'
import { newId } from '@/shared/id'

/** Максимальный |угол створки| (градусы) — панель инструмента и валидация. */
export const MAX_DOOR_OPEN_ANGLE = 150
/** Угол створки по умолчанию (предлагается панелью), градусы. */
export const DEFAULT_DOOR_OPEN_ANGLE = 30

/**
 * Дверь — самостоятельная сущность (не привязана к стене): проём задаётся
 * отрезком `a`–`b` (закрытая створка лежит на нём), петля — в точке `a`.
 * `openAngle` — угол открытия в градусах: 0 = закрыта, знак — сторона
 * открывания. `imageId = null` — отрисовка без текстуры (жирная заливка).
 */
export interface Door {
  readonly id: string
  readonly a: Point
  readonly b: Point
  readonly openAngle: number
  readonly imageId: string | null
}

export function isValidDoorOpenAngle(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_DOOR_OPEN_ANGLE
  )
}

export function isValidDoor(door: Door): boolean {
  return (
    typeof door.id === 'string' &&
    door.id.length > 0 &&
    isFinitePoint(door.a) &&
    isFinitePoint(door.b) &&
    distance(door.a, door.b) > 0 &&
    isValidDoorOpenAngle(door.openAngle) &&
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
  if (!isValidDoorOpenAngle(door.openAngle)) {
    throw new RangeError(
      `Door openAngle must be within ±${MAX_DOOR_OPEN_ANGLE} degrees, got ${String(door.openAngle)}`,
    )
  }
  if (door.imageId !== null && (typeof door.imageId !== 'string' || door.imageId.length === 0)) {
    throw new RangeError('Door imageId must be null or a non-empty string')
  }
}

export function createDoor(
  a: Point,
  b: Point,
  options: { openAngle?: number; imageId?: string | null; id?: string } = {},
): Door {
  const door: Door = {
    id: options.id ?? newId(),
    a: { x: a.x, y: a.y },
    b: { x: b.x, y: b.y },
    openAngle: options.openAngle ?? 0,
    imageId: options.imageId ?? null,
  }
  assertValidDoor(door)
  return door
}

export function findDoorById(doors: readonly Door[], id: string): Door | undefined {
  return doors.find((door) => door.id === id)
}

/** Середина проёма — точка привязки для хит-теста и разрыва стены. */
export function doorCenter(door: Door): Point {
  return { x: (door.a.x + door.b.x) / 2, y: (door.a.y + door.b.y) / 2 }
}

/** Длина проёма (закрытой створки) в клетках. */
export function doorLength(door: Door): number {
  return distance(door.a, door.b)
}

/** Конец створки при текущем `openAngle`: b при 0°, иначе поворот вокруг петли `a`. */
export function doorLeafEnd(door: Door): Point {
  const angle = (door.openAngle * Math.PI) / 180
  const dx = door.b.x - door.a.x
  const dy = door.b.y - door.a.y
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x: door.a.x + dx * cos - dy * sin, y: door.a.y + dx * sin + dy * cos }
}

/** Цикл угла кликом по двери: `+A → −A → 0 → +A` (A = `step`). */
export function cycleDoorOpenAngle(
  current: number,
  step: number = DEFAULT_DOOR_OPEN_ANGLE,
): number {
  if (current > 0) return -step
  if (current < 0) return 0
  return step
}
