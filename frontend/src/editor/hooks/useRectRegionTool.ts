import { useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Command } from '../model/commands'
import { snapToHalfGrid } from '../model/snap'
import type { MapModel, TileTypeName } from '../model/types'
import type { Viewport } from '../render/viewport'
import { isWorldPointInsideMap } from '../tools/isInsideMap'
import { buildRegionCommand } from '../tools/regionCommit'
import { hasRectArea, rectPolygon } from '../tools/regions'
import { useWorldPointFromEvent } from './useCellFromEvent'

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
 * Инструмент «Регион-прямоугольник»: drag растягивает живое превью полигона от
 * точки до точки, отпускание коммитит addRegion (с авто-стенами — составной
 * командой). Точки привязаны к полуклеточной сетке. Ластик области — tileType
 * 'empty'.
 */
export function useRectRegionTool(options: RectRegionToolOptions): {
  preview: RectPreview | null
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerCancel: () => void
  }
} {
  const { canvasRef, active, model, tileType, autoWalls, viewportRef, onCommit } = options
  const [drag, setDrag] = useState<DragState | null>(null)
  const [preview, setPreview] = useState<RectPreview | null>(null)

  const worldFromEvent = useWorldPointFromEvent(canvasRef, viewportRef)

  // Esc/смена инструмента деактивируют хук: незавершённый драг не «зависает»
  // (сброс в рендер-фазе, как в остальных инструментах, — без каскадного рендера).
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (!active) {
      setDrag(null)
      setPreview(null)
    }
  }

  /** Мировая точка события: границы карты проверяются до снапа, затем — 0.5. */
  function pointFromEvent(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): { x: number; y: number } | null {
    const world = worldFromEvent(event)
    if (!isWorldPointInsideMap(model, world.x, world.y)) return null
    return snapToHalfGrid(world)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active || event.button !== LEFT_BUTTON || drag !== null) return
    const point = pointFromEvent(event)
    if (!point) return
    event.preventDefault()
    try {
      canvasRef.current?.setPointerCapture(event.pointerId)
    } catch {
      // Pointer уже неактивен; жест завершится по pointerup/cancel.
    }
    setDrag({ pointerId: event.pointerId, start: point, current: point })
    setPreview({ start: point, current: point })
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return
    if ((event.buttons & 1) === 0) {
      finishDrag(drag)
      return
    }
    const point = pointFromEvent(event)
    if (!point) return
    setDrag({ ...drag, current: point })
    setPreview({ start: drag.start, current: point })
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return
    finishDrag(drag)
  }

  function onPointerCancel() {
    setDrag(null)
    setPreview(null)
  }

  function finishDrag(current: DragState) {
    setDrag(null)
    setPreview(null)
    const polygon = rectPolygon(
      current.start.x,
      current.start.y,
      current.current.x,
      current.current.y,
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
