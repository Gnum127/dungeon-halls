import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Command } from '../model/commands'
import { nearestWallSegment } from '../model/wallSegments'
import { cycleDoorOpenAngle } from '../model/doors'
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
/** Ширина проёма, ставящегося кликом по стене (клетки). */
const DOOR_PLACEMENT_WIDTH = 1

function normalize(dx: number, dy: number): Point {
  const length = Math.hypot(dx, dy)
  if (length === 0) return { x: 1, y: 0 }
  return { x: dx / length, y: dy / length }
}

/**
 * Инструмент дверей: клик по существующей двери циклично меняет угол створки
 * (`+A → −A → 0`), правый клик — удаляет; иначе клик у стены ставит новую дверь
 * (проём 1 клетка вдоль касательной стены). Хит-тест двери — `doorHitTest`.
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

    const hitDoorId = doorHitTest(world, model.doors, DOOR_HIT_RADIUS)
    if (hitDoorId) {
      event.preventDefault()
      const door = model.doors.find((candidate) => candidate.id === hitDoorId)
      if (!door) return
      if (event.button === RIGHT_BUTTON) {
        onCommit({ kind: 'removeDoor', id: hitDoorId })
      } else {
        onCommit({ kind: 'setDoorAngle', id: hitDoorId, openAngle: cycleDoorOpenAngle(door.openAngle) })
      }
      return
    }

    if (event.button !== LEFT_BUTTON) return
    const hit = nearestWallSegment(model.walls, world)
    if (!hit || hit.distance > MAX_WALL_DISTANCE) return

    const segment = hit.segment.points
    const tangent = normalize(
      segment[hit.index + 1].x - segment[hit.index].x,
      segment[hit.index + 1].y - segment[hit.index].y,
    )
    const half = DOOR_PLACEMENT_WIDTH / 2

    event.preventDefault()
    onCommit({
      kind: 'addDoor',
      a: { x: hit.point.x - tangent.x * half, y: hit.point.y - tangent.y * half },
      b: { x: hit.point.x + tangent.x * half, y: hit.point.y + tangent.y * half },
      openAngle: 0,
      imageId,
    })
  }

  return { handlers: { onPointerDown } }
}
