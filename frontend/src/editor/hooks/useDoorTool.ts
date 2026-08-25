import { useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Command } from '../model/commands'
import { doorAtEdge, hasWall, normalizeEdge } from '../model/walls'
import type { MapModel } from '../model/types'
import type { WallEdge } from '../model/walls'
import type { Viewport } from '../render/viewport'
import { nearestEdgeAt } from '../tools/walls'

interface DoorToolOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  /** false — инструмент неактивен, события игнорируются. */
  active: boolean
  model: MapModel
  viewportRef: RefObject<Viewport>
  onCommit: (command: Command | null) => void
}

const LEFT_BUTTON = 0
const RIGHT_BUTTON = 2

/**
 * Инструмент дверей: клик у стены ставит дверь (одна на ребро), повторный
 * клик переключает open/closed, правый клик удаляет дверь с ребра.
 * Двигает подсветку ближайшего ребра под курсором.
 */
export function useDoorTool(options: DoorToolOptions): {
  hoverEdge: WallEdge | null
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerLeave: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  }
} {
  const { canvasRef, active, model, viewportRef, onCommit } = options
  const [hoverEdge, setHoverEdge] = useState<WallEdge | null>(null)

  function edgeFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): WallEdge | null {
    const canvas = canvasRef.current
    const viewport = viewportRef.current
    if (!canvas || !viewport) return null
    const rect = canvas.getBoundingClientRect()
    const edge = nearestEdgeAt(
      viewport,
      event.clientX - rect.left,
      event.clientY - rect.top,
      model.width,
      model.height,
    )
    return edge ? normalizeEdge(edge, model.width, model.height) : null
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active) return
    if (event.button !== LEFT_BUTTON && event.button !== RIGHT_BUTTON) return
    const edge = edgeFromEvent(event)
    if (!edge || !hasWall(model.walls, edge)) return

    const existing = doorAtEdge(model.doors, edge)
    if (existing) {
      if (event.button === LEFT_BUTTON) {
        onCommit({ kind: 'setDoorOpen', id: existing.id, open: !existing.open })
      } else {
        onCommit({ kind: 'removeDoor', id: existing.id })
      }
      return
    }
    if (event.button === LEFT_BUTTON) {
      onCommit({ kind: 'addDoor', edge })
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active) return
    setHoverEdge(edgeFromEvent(event))
  }

  function onPointerLeave() {
    if (!active) return
    setHoverEdge(null)
  }

  return {
    hoverEdge,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerLeave,
    },
  }
}
