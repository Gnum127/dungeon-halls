import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Command } from '../model/commands'
import { nearestWallSegment, wallSegmentPositionOf } from '../model/wallSegments'
import { doorHitTest } from '../tools/doorHitTest'
import type { MapModel } from '../model/types'
import type { Point } from '@/shared/point'
import type { Viewport } from '../render/viewport'
import { useWorldPointFromEvent } from './useCellFromEvent'

interface DoorToolOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  active: boolean
  model: MapModel
  /** Текстура ставящейся двери (null = жирная линия). */
  imageId: string | null
  viewportRef: RefObject<Viewport>
  onCommit: (command: Command | null) => void
}

const LEFT_BUTTON = 0
const RIGHT_BUTTON = 2
/** Максимальное расстояние до осевой стены (в клетках) для постановки двери. */
const MAX_WALL_DISTANCE = 0.5
/** Радиус попадания по двери в мировых клетках (примерно половина полотна). */
const DOOR_HIT_RADIUS = 0.15

/**
 * Инструмент дверей: клик по существующей двери переключает open/closed,
 * правый клик по ней — удаляет; иначе клик у стены ставит новую дверь
 * (позиция по проекции на сегмент). Хит-тест двери — `doorHitTest`.
 */
export function useDoorTool(options: DoorToolOptions): {
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  }
} {
  const { canvasRef, active, model, imageId, viewportRef, onCommit } = options
  const worldFromEvent = useWorldPointFromEvent(canvasRef, viewportRef)

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active) return
    if (event.button !== LEFT_BUTTON && event.button !== RIGHT_BUTTON) return
    const world: Point = worldFromEvent(event)
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return

    const hitDoorId = doorHitTest(world, model.doors, model.walls, DOOR_HIT_RADIUS)
    if (hitDoorId) {
      event.preventDefault()
      const door = model.doors.find((candidate) => candidate.id === hitDoorId)
      if (!door) return
      if (event.button === RIGHT_BUTTON) {
        onCommit({ kind: 'removeDoor', id: hitDoorId })
      } else {
        onCommit({ kind: 'setDoorOpen', id: hitDoorId, open: !door.open })
      }
      return
    }

    if (event.button !== LEFT_BUTTON) return
    const hit = nearestWallSegment(model.walls, world)
    if (!hit || hit.distance > MAX_WALL_DISTANCE) return
    const position = wallSegmentPositionOf(hit.segment, world)

    event.preventDefault()
    onCommit({
      kind: 'addDoor',
      wallSegmentId: hit.segment.id,
      position,
      imageId,
    })
  }

  return { handlers: { onPointerDown } }
}
