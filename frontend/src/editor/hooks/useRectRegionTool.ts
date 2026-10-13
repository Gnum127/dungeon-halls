import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Command } from '../model/commands'
import type { MapModel, TileTypeName } from '../model/types'
import type { Viewport } from '../render/viewport'
import { isInsideMap } from '../tools/isInsideMap'
import { buildRegionCommand } from '../tools/regionCommit'
import { hasRectArea, rectPolygon } from '../tools/regions'
import { useCellFromEvent } from './useCellFromEvent'

interface RectRegionToolOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  active: boolean
  model: MapModel
  tileType: TileTypeName
  autoWalls: boolean
  viewportRef: RefObject<Viewport>
  onCommit: (command: Command | null) => void
}

interface DragState {
  pointerId: number
  start: { x: number; y: number }
  current: { x: number; y: number }
}

export interface RectPreview {
  readonly start: { x: number; y: number }
  readonly current: { x: number; y: number }
}

const LEFT_BUTTON = 0

/**
 * Инструмент «Регион-прямоугольник»: drag растягивает живое превью полигона,
 * отпускание коммитит addRegion (с авто-стенами — составной командой).
 * Ластик области — tileType 'empty'.
 */
export function useRectRegionTool(
  options: RectRegionToolOptions,
): {
  preview: RectPreview | null
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  }
} {
  const { canvasRef, active, model, tileType, autoWalls, viewportRef, onCommit } = options
  const dragRef = useRef<DragState | null>(null)
  const [preview, setPreview] = useState<RectPreview | null>(null)

  const cellFromEvent = useCellFromEvent(canvasRef, viewportRef)

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
    const polygon = rectPolygon(
      drag.start.x,
      drag.start.y,
      drag.current.x,
      drag.current.y,
      model.grid.width,
      model.grid.height,
    )
    if (!hasRectArea(polygon)) return
    onCommit(buildRegionCommand(model, tileType, polygon, autoWalls))
  }

  return {
    preview,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}
