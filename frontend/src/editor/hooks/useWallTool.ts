import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Command } from '../model/commands'
import { createWallSegment } from '../model/wallSegments'
import type { Point } from '@/shared/point'
import type { Viewport } from '../render/viewport'
import { useWorldPointFromEvent } from './useCellFromEvent'

interface WallToolOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  active: boolean
  viewportRef: RefObject<Viewport>
  onCommit: (command: Command | null) => void
}

export interface WallPreview {
  readonly a: Point
  readonly b: Point
}

const LEFT_BUTTON = 0
const SNAP = 0.5

/** Привязка мировой точки к полуклеточной сетке (грани и центры клеток). */
function snap(point: Point): Point {
  return { x: Math.round(point.x / SNAP) * SNAP, y: Math.round(point.y / SNAP) * SNAP }
}

/**
 * Ручной инструмент стен: протяжка ЛКМ создаёт один сегмент стены (привязка к
 * полуклетке — грани и центры клеток). Для перегородок при выключенных авто-стенах.
 */
export function useWallTool(options: WallToolOptions): {
  preview: WallPreview | null
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerCancel: () => void
  }
} {
  const { canvasRef, active, viewportRef, onCommit } = options
  const worldFromEvent = useWorldPointFromEvent(canvasRef, viewportRef)
  const dragRef = useRef<{ pointerId: number; a: Point; b: Point } | null>(null)
  const [preview, setPreview] = useState<WallPreview | null>(null)

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active || event.button !== LEFT_BUTTON || dragRef.current !== null) return
    const world = snap(worldFromEvent(event))
    event.preventDefault()
    try {
      canvasRef.current?.setPointerCapture(event.pointerId)
    } catch {
      // Pointer уже неактивен; жест завершится по pointerup/cancel.
    }
    dragRef.current = { pointerId: event.pointerId, a: world, b: world }
    setPreview({ a: world, b: world })
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if ((event.buttons & 1) === 0) {
      finishDrag()
      return
    }
    const world = snap(worldFromEvent(event))
    drag.b = world
    setPreview({ a: drag.a, b: world })
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
    finishDrag()
  }

  function onPointerCancel() {
    dragRef.current = null
    setPreview(null)
  }

  function finishDrag() {
    const drag = dragRef.current
    dragRef.current = null
    setPreview(null)
    if (!drag) return
    if (drag.a.x === drag.b.x && drag.a.y === drag.b.y) return
    const segment = createWallSegment([drag.a, drag.b])
    onCommit({ kind: 'setWalls', updates: [{ segment, present: true }] })
  }

  return {
    preview,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}
