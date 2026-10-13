import type { WallSegment } from './wallSegments'
import { newId } from '@/shared/id'

/** Минимальный зазор между дверями на одном сегменте (в долях длины). */
export const DOOR_POSITION_TOLERANCE = 0.05

/**
 * Дверь привязана к стеновому сегменту: позиция задаётся долей длины [0..1]
 * ВДОЛЬ ВСЕЙ ломаной (0 — начало, 1 — конец); мировую точку считает
 * pointAlongWallSegment. Ориентация производна от сегмента. `imageId = null`
 * означает отрисовку жирной линией (без текстуры).
 */
export interface Door {
  readonly id: string
  readonly wallSegmentId: string
  readonly position: number
  readonly open: boolean
  readonly imageId: string | null
}

export function isValidDoorPosition(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

export function isValidDoor(door: Door): boolean {
  return (
    typeof door.id === 'string' &&
    door.id.length > 0 &&
    typeof door.wallSegmentId === 'string' &&
    door.wallSegmentId.length > 0 &&
    isValidDoorPosition(door.position) &&
    typeof door.open === 'boolean' &&
    (door.imageId === null || (typeof door.imageId === 'string' && door.imageId.length > 0))
  )
}

export function assertValidDoor(door: Door, segments?: readonly WallSegment[]): void {
  if (typeof door.id !== 'string' || door.id.length === 0) {
    throw new RangeError('Door id must be a non-empty string')
  }
  if (typeof door.wallSegmentId !== 'string' || door.wallSegmentId.length === 0) {
    throw new RangeError('Door wallSegmentId must be a non-empty string')
  }
  if (!isValidDoorPosition(door.position)) {
    throw new RangeError(`Door position must be in [0, 1], got ${String(door.position)}`)
  }
  if (typeof door.open !== 'boolean') {
    throw new RangeError('Door open must be a boolean')
  }
  if (door.imageId !== null && (typeof door.imageId !== 'string' || door.imageId.length === 0)) {
    throw new RangeError('Door imageId must be null or a non-empty string')
  }
  if (segments && !segments.some((segment) => segment.id === door.wallSegmentId)) {
    throw new RangeError(`Door references unknown wall segment: ${door.wallSegmentId}`)
  }
}

/** Дверь, стоящая на том же сегменте ближе допуска (вплотную). */
export function doorPlacementConflict(
  doors: readonly Door[],
  wallSegmentId: string,
  position: number,
  excludeId?: string,
): Door | undefined {
  return doors.find(
    (door) =>
      door.id !== excludeId &&
      door.wallSegmentId === wallSegmentId &&
      Math.abs(door.position - position) < DOOR_POSITION_TOLERANCE,
  )
}

export function findDoorById(doors: readonly Door[], id: string): Door | undefined {
  return doors.find((door) => door.id === id)
}

export function doorsOnSegment(doors: readonly Door[], wallSegmentId: string): Door[] {
  return doors.filter((door) => door.wallSegmentId === wallSegmentId)
}

export function createDoor(
  wallSegmentId: string,
  position: number,
  options: { open?: boolean; imageId?: string | null; id?: string } = {},
): Door {
  const door: Door = {
    id: options.id ?? newId(),
    wallSegmentId,
    position,
    open: options.open ?? false,
    imageId: options.imageId ?? null,
  }
  assertValidDoor(door)
  return door
}
