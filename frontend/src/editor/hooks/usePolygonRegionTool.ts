import { useEffect, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Command } from '../model/commands'
import type { MapModel, TileTypeName } from '../model/types'
import type { Viewport } from '../render/viewport'
import { isEditableTarget } from '../dom/isEditableTarget'
import { isInsideMap } from '../tools/isInsideMap'
import { buildRegionCommand } from '../tools/regionCommit'
import { regularPolygonPoints } from '../tools/regions'
import { useCellFromEvent } from './useCellFromEvent'

interface PolygonRegionToolOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  active: boolean
  model: MapModel
  tileType: TileTypeName
  vertices: number
  autoWalls: boolean
  viewportRef: RefObject<Viewport>
  onCommit: (command: Command | null) => void
}

export interface PolygonPreview {
  readonly center: { x: number; y: number }
  readonly current: { x: number; y: number }
}

const LEFT_BUTTON = 0

/**
 * Инструмент «Регион-многогранник»: первый клик — центр, курсор тянет
 * радиусную точку (задаёт поворот и размер), второй клик фиксирует правильный
 * N-угольник. Esc отменяет.
 */
export function usePolygonRegionTool(
  options: PolygonRegionToolOptions,
): {
  preview: PolygonPreview | null
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerLeave: () => void
  }
} {
  const { canvasRef, active, model, tileType, vertices, autoWalls, viewportRef, onCommit } = options
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null)
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null)
  const cellFromEvent = useCellFromEvent(canvasRef, viewportRef)
  // При деактивации инструмента сбрасываем недостроенный полигон во время
  // рендера (не в эффекте — иначе лишний каскадный рендер React).
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (!active) {
      setCenter(null)
      setCurrent(null)
    }
  }

  function commit(radialCell: { x: number; y: number }) {
    if (!center) return
    const centerPoint = { x: center.x + 0.5, y: center.y + 0.5 }
    const radialPoint = { x: radialCell.x + 0.5, y: radialCell.y + 0.5 }
    const points = regularPolygonPoints(centerPoint, radialPoint, vertices)
    if (points.length < 3) return
    setCenter(null)
    setCurrent(null)
    onCommit(buildRegionCommand(model, tileType, points, autoWalls))
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active || event.button !== LEFT_BUTTON) return
    const cell = cellFromEvent(event)
    if (!isInsideMap(model, cell.x, cell.y)) return
    event.preventDefault()
    if (!center) {
      setCenter(cell)
      setCurrent(cell)
      return
    }
    commit(cell)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active || !center) return
    setCurrent(cellFromEvent(event))
  }

  function onPointerLeave() {
    // Курсор ушёл — превью радиуса скрываем, центр оставляем.
    if (center) setCurrent(center)
  }

  useEffect(() => {
    if (!active || !center) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isEditableTarget(event.target)) return
      setCenter(null)
      setCurrent(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, center])

  const preview = center ? { center, current: current ?? center } : null

  return { preview, handlers: { onPointerDown, onPointerMove, onPointerLeave } }
}
