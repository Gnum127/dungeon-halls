import { useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Command } from '../model/commands'
import { cycleDoorOpenAngle } from '../model/doors'
import { doorHitTest } from '../tools/doorHitTest'
import { doorEndpoints } from '../tools/doorPlacement'
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
  /** Угол створки для новой двери и шаг цикла кликом (градусы). */
  openAngle: number
  viewportRef: RefObject<Viewport>
  onCommit: (command: Command | null) => void
}

export interface DoorPreview {
  readonly a: Point
  readonly b: Point
}

const LEFT_BUTTON = 0
const RIGHT_BUTTON = 2
/** Радиус попадания по двери в мировых клетках (примерно половина полотна). */
const DOOR_HIT_RADIUS = 0.15

function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y
}

/**
 * Инструмент дверей в 2 клика: первый клик — начало проёма, второй — конец
 * (снап к характеристическим точкам; на стене — вдоль стены). Клик по
 * существующей двери цикличный угол створки (`+A → −A → 0`), правый клик —
 * удаляет. Хит-тест двери — `doorHitTest`.
 */
export function useDoorTool(options: DoorToolOptions): {
  preview: DoorPreview | null
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerCancel: () => void
  }
} {
  const { canvasRef, active, model, imageId, openAngle, viewportRef, onCommit } = options
  const worldFromEvent = useWorldPointFromEvent(canvasRef, viewportRef)
  const [pending, setPending] = useState<{ startWorld: Point; a: Point; b: Point } | null>(null)
  // При деактивации инструмента сбрасываем недостроенный проём во время рендера.
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (!active) setPending(null)
  }

  function handleDoorHit(hitDoorId: string, button: number): void {
    const door = model.doors.find((candidate) => candidate.id === hitDoorId)
    if (!door) return
    setPending(null)
    if (button === RIGHT_BUTTON) {
      onCommit({ kind: 'removeDoor', id: hitDoorId })
    } else {
      onCommit({
        kind: 'setDoorAngle',
        id: hitDoorId,
        openAngle: cycleDoorOpenAngle(door.openAngle, openAngle),
      })
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active) return
    if (event.button !== LEFT_BUTTON && event.button !== RIGHT_BUTTON) return
    const world: Point = worldFromEvent(event)
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return

    const hitDoorId = doorHitTest(world, model.doors, DOOR_HIT_RADIUS)
    if (hitDoorId) {
      event.preventDefault()
      handleDoorHit(hitDoorId, event.button)
      return
    }
    if (event.button !== LEFT_BUTTON) return

    event.preventDefault()
    if (!pending) {
      const { a, b } = doorEndpoints(model, world, world)
      setPending({ startWorld: world, a, b })
      return
    }
    const { a, b } = doorEndpoints(model, pending.startWorld, world)
    setPending(null)
    if (pointsEqual(a, b)) return
    onCommit({ kind: 'addDoor', a, b, openAngle, imageId })
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active || !pending) return
    const world = worldFromEvent(event)
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return
    const { a, b } = doorEndpoints(model, pending.startWorld, world)
    setPending((previous) => (previous ? { startWorld: previous.startWorld, a, b } : previous))
  }

  function onPointerCancel() {
    setPending(null)
  }

  return {
    preview: pending ? { a: pending.a, b: pending.b } : null,
    handlers: { onPointerDown, onPointerMove, onPointerCancel },
  }
}
