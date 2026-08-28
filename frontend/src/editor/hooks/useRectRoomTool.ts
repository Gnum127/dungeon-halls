import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { RefObject } from 'react'
import type { Command } from '../model/commands'
import { rectRoom } from '../model/rooms'
import type { MapModel } from '../model/types'
import type { Viewport } from '../render/viewport'
import { isInsideMap } from '../tools/brush'
import type { Cell } from '../tools/brush'
import { commitRoom } from '../tools/rooms'
import { useCellFromEvent } from './useCellFromEvent'

interface RectRoomToolOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  /** false — инструмент неактивен, события игнорируются. */
  active: boolean
  model: MapModel
  viewportRef: RefObject<Viewport>
  onCommit: (command: Command | null) => void
}

interface DragState {
  pointerId: number
  start: Cell
  current: Cell
}

export interface RectPreview {
  readonly start: Cell
  readonly current: Cell
}

const LEFT_BUTTON = 0

/**
 * Инструмент «Комната-прямоугольник»: зажатая ЛКМ растягивает живое превью
 * (пол + периметровые стены), отпускание коммитит одну команду addRoom.
 * Клик без перетаскивания создаёт комнату 1×1. pointercancel отбрасывает.
 */
export function useRectRoomTool(options: RectRoomToolOptions): {
  preview: RectPreview | null
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  }
} {
  const { canvasRef, active, model, viewportRef, onCommit } = options
  const dragRef = useRef<DragState | null>(null)
  const [preview, setPreview] = useState<RectPreview | null>(null)

  const cellFromEvent = useCellFromEvent(canvasRef, viewportRef, model.gridType)

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active || event.button !== LEFT_BUTTON || dragRef.current !== null) return
    const cell = cellFromEvent(event)
    if (!isInsideMap(model, cell.x, cell.y)) return
    event.preventDefault()
    try {
      canvasRef.current?.setPointerCapture(event.pointerId)
    } catch {
      // Pointer уже неактивен; жест завершится по pointerup/cancel.
    }
    dragRef.current = { pointerId: event.pointerId, start: cell, current: cell }
    setPreview({ start: cell, current: cell })
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if ((event.buttons & 1) === 0) {
      // Кнопку отпустили вне окна — считаем жест завершённым.
      finishDrag()
      return
    }
    const cell = cellFromEvent(event)
    drag.current = cell
    setPreview({ start: drag.start, current: cell })
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
    // Геометрия сама обрезается по границам карты (rectRoom).
    onCommit(
      commitRoom(
        rectRoom(drag.start.x, drag.start.y, drag.current.x, drag.current.y, model.width, model.height),
      ),
    )
  }

  return {
    preview,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}